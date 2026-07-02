-- Task Enhancements Migration
-- Adds task dependencies, priorities, and extended due date support

-- ============================================
-- ENHANCE SERVICE_TASKS TABLE
-- ============================================

-- Add new columns for priorities and dependencies
ALTER TABLE service_tasks
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER,
ADD COLUMN IF NOT EXISTS is_blocking BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS parent_task_id UUID REFERENCES service_tasks(id) ON DELETE SET NULL;

-- Update the priority constraint
ALTER TABLE service_tasks
DROP CONSTRAINT IF EXISTS service_tasks_priority_check;

ALTER TABLE service_tasks
ADD CONSTRAINT service_tasks_priority_check
CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Index for priority queries
CREATE INDEX IF NOT EXISTS idx_service_tasks_priority ON service_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_service_tasks_due_date ON service_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_service_tasks_parent ON service_tasks(parent_task_id);

-- ============================================
-- TASK DEPENDENCIES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES service_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES service_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'finish_to_start', -- 'finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'
  lag_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  
  -- Prevent duplicate dependencies
  UNIQUE(task_id, depends_on_task_id),
  -- Prevent circular dependencies
  CHECK (task_id != depends_on_task_id)
);

-- Index for dependency queries
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_church_id ON task_dependencies(church_id);

-- Constraint for valid dependency types
ALTER TABLE task_dependencies
ADD CONSTRAINT task_dependencies_type_check
CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'));

-- ============================================
-- TASK COMPLETION LOG TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS task_completion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES service_tasks(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_seconds INTEGER, -- Time from task creation to completion
  notes TEXT,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_task_completion_log_task_id ON task_completion_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_service_id ON task_completion_log(service_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_completed_at ON task_completion_log(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_church_id ON task_completion_log(church_id);

-- ============================================
-- TASK TEMPLATE ENHANCEMENTS
-- ============================================

-- Add priority and duration to template items
ALTER TABLE task_template_items
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS estimated_duration_minutes INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS default_notes TEXT;

-- Update the priority constraint for templates
ALTER TABLE task_template_items
DROP CONSTRAINT IF EXISTS task_template_items_priority_check;

ALTER TABLE task_template_items
ADD CONSTRAINT task_template_items_priority_check
CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- ============================================
-- FUNCTION TO CHECK IF TASK CAN BE COMPLETED
-- ============================================
CREATE OR REPLACE FUNCTION can_complete_task(task_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  incomplete_deps INTEGER;
BEGIN
  -- Count incomplete dependencies
  SELECT COUNT(*) INTO incomplete_deps
  FROM task_dependencies td
  JOIN service_tasks st ON td.depends_on_task_id = st.id
  WHERE td.task_id = task_uuid
    AND st.status != 'done';
  
  -- Task can be completed if no incomplete dependencies
  RETURN incomplete_deps = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION TO GET TASK DEPENDENCIES
-- ============================================
CREATE OR REPLACE FUNCTION get_task_dependencies(task_uuid UUID)
RETURNS TABLE (
  task_id UUID,
  depends_on_id UUID,
  dependency_type TEXT,
  lag_minutes INTEGER,
  depends_on_title TEXT,
  depends_on_status TEXT,
  depends_on_assigned_to TEXT,
  is_blocking BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    td.task_id,
    td.depends_on_task_id,
    td.dependency_type,
    td.lag_minutes,
    st.title,
    st.status,
    tm.name,
    td.task_id IN (
      SELECT td2.task_id
      FROM task_dependencies td2
      WHERE td2.depends_on_task_id = td.task_id
    ) OR st.is_blocking
  FROM task_dependencies td
  JOIN service_tasks st ON td.depends_on_task_id = st.id
  LEFT JOIN team_members tm ON st.assigned_team_member_id = tm.id
  WHERE td.task_id = task_uuid
  ORDER BY st.is_blocking DESC, st.priority DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- FUNCTION TO UPDATE TASK FROM TEMPLATE
-- ============================================
CREATE OR REPLACE FUNCTION create_task_from_template(
  template_item_uuid UUID,
  service_uuid UUID,
  assigned_member_uuid UUID DEFAULT NULL,
  assigned_role_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_task_id UUID;
  template_item task_template_items%ROWTYPE;
  template task_templates%ROWTYPE;
  service_date DATE;
BEGIN
  -- Get template item with template info
  SELECT 
    tti.*, 
    tt.recurrence,
    tt.role_scope,
    tt.church_id
  INTO template_item, template
  FROM task_template_items tti
  JOIN task_templates tt ON tti.template_id = tt.id
  WHERE tti.id = template_item_uuid;
  
  -- Get service date
  SELECT date::DATE INTO service_date
  FROM services
  WHERE id = service_uuid;
  
  -- Create the task
  INSERT INTO service_tasks (
    service_id,
    church_id,
    template_id,
    title,
    notes,
    assigned_team_member_id,
    assigned_role,
    position,
    status,
    priority,
    due_offset_minutes,
    estimated_duration_minutes
  )
  VALUES (
    service_uuid,
    template_item.church_id,
    template_item.template_id,
    template_item.title,
    COALESCE(template_item.default_notes, ''),
    assigned_member_uuid,
    assigned_role_param,
    template_item.position,
    'pending',
    template_item.priority,
    NULL, -- Calculate based on service time if needed
    template_item.estimated_duration_minutes
  )
  RETURNING id INTO new_task_id;
  
  RETURN new_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER FOR TASK COMPLETION LOGGING
-- ============================================
CREATE OR REPLACE FUNCTION log_task_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    -- Log task completion
    INSERT INTO task_completion_log (
      task_id,
      service_id,
      completed_by,
      completed_at,
      duration_seconds,
      notes,
      church_id
    )
    VALUES (
      NEW.id,
      NEW.service_id,
      NEW.completed_by,
      NEW.completed_at,
      EXTRACT(EPOCH FROM (NEW.completed_at - NEW.created_at))::INTEGER,
      NEW.notes,
      NEW.church_id
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for task completion logging
DROP TRIGGER IF EXISTS task_completion_logging_trigger ON service_tasks;
CREATE TRIGGER task_completion_logging_trigger
  AFTER UPDATE OF status ON service_tasks
  FOR EACH ROW
  WHEN (NEW.status = 'done' AND OLD.status != 'done')
  EXECUTE FUNCTION log_task_completion();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Task Dependencies RLS
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task dependencies for their church"
  ON task_dependencies FOR SELECT
  USING (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

CREATE POLICY "Users can create task dependencies for their church"
  ON task_dependencies FOR INSERT
  WITH CHECK (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

CREATE POLICY "Users can delete task dependencies for their church"
  ON task_dependencies FOR DELETE
  USING (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

-- Task Completion Log RLS
ALTER TABLE task_completion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task completion logs for their church"
  ON task_completion_log FOR SELECT
  USING (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

-- ============================================
-- VIEW FOR TASKS WITH DEPENDENCIES
-- ============================================
CREATE OR REPLACE VIEW tasks_with_dependencies AS
SELECT
  st.*,
  COALESCE(
    json_agg(
      json_build_object(
        'depends_on_id', td.depends_on_task_id,
        'dependency_type', td.dependency_type,
        'lag_minutes', td.lag_minutes,
        'depends_on_title', st2.title,
        'depends_on_status', st2.status
      )
    ) FILTER (WHERE td.id IS NOT NULL),
    '[]'::json
  ) AS dependencies,
  COALESCE(
    json_agg(
      json_build_object(
        'dependent_id', td2.task_id,
        'dependency_type', td2.dependency_type,
        'dependent_title', st3.title,
        'dependent_status', st3.status
      )
    ) FILTER (WHERE td2.id IS NOT NULL),
    '[]'::json
  ) AS dependents,
  can_complete_task(st.id) AS can_be_completed
FROM service_tasks st
LEFT JOIN task_dependencies td ON st.id = td.task_id
LEFT JOIN service_tasks st2 ON td.depends_on_task_id = st2.id
LEFT JOIN task_dependencies td2 ON st.id = td2.depends_on_task_id
LEFT JOIN service_tasks st3 ON td2.task_id = st3.id
GROUP BY st.id;

-- ============================================
-- COMPLETED
-- ============================================

-- Add comments for documentation
COMMENT ON TABLE task_dependencies IS 'Stores dependencies between tasks, allowing for complex task workflows';
COMMENT ON TABLE task_completion_log IS 'Audit trail of task completions for analytics and reporting';
COMMENT ON COLUMN service_tasks.priority IS 'Task priority: low, medium, high, or urgent';
COMMENT ON COLUMN service_tasks.due_date IS 'Absolute due date for task completion';
COMMENT ON COLUMN service_tasks.estimated_duration_minutes IS 'Estimated time to complete the task';
COMMENT ON COLUMN service_tasks.is_blocking IS 'Whether this task blocks other tasks from starting';
COMMENT ON FUNCTION can_complete_task IS 'Checks if a task can be completed based on its dependencies';