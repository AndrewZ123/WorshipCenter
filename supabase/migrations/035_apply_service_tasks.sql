-- Apply service_tasks tables (migrations 021 + 029 combined)
-- Run this in the Supabase SQL editor if migrations haven't been applied
-- All statements use IF NOT EXISTS / IF EXISTS guards for safe re-runs

-- ============================================
-- 1. Task templates (reusable checklists)
-- ============================================
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  recurrence TEXT DEFAULT 'one_off',
  role_scope TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 2. Task template items
-- ============================================
CREATE TABLE IF NOT EXISTS task_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT TRUE
);

-- ============================================
-- 3. Service tasks (the main table)
-- ============================================
CREATE TABLE IF NOT EXISTS service_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  template_id UUID REFERENCES task_templates(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  notes TEXT,
  assigned_team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
  assigned_role TEXT,
  position INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  due_offset_minutes INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  priority TEXT DEFAULT 'medium',
  due_date TIMESTAMP WITH TIME ZONE,
  estimated_duration_minutes INTEGER,
  is_blocking BOOLEAN DEFAULT FALSE,
  parent_task_id UUID REFERENCES service_tasks(id) ON DELETE SET NULL,
  depends_on_task_id UUID REFERENCES service_tasks(id) ON DELETE SET NULL
);

-- Priority constraint
ALTER TABLE service_tasks DROP CONSTRAINT IF EXISTS service_tasks_priority_check;
ALTER TABLE service_tasks
  ADD CONSTRAINT service_tasks_priority_check
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- depends_on_task_id column (used by client for simple single-dependency tracking)
ALTER TABLE service_tasks ADD COLUMN IF NOT EXISTS depends_on_task_id UUID REFERENCES service_tasks(id) ON DELETE SET NULL;

-- ============================================
-- 4. Task dependencies
-- ============================================
CREATE TABLE IF NOT EXISTS task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES service_tasks(id) ON DELETE CASCADE,
  depends_on_task_id UUID NOT NULL REFERENCES service_tasks(id) ON DELETE CASCADE,
  dependency_type TEXT DEFAULT 'finish_to_start',
  lag_minutes INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  UNIQUE(task_id, depends_on_task_id),
  CHECK (task_id != depends_on_task_id)
);

ALTER TABLE task_dependencies
  ADD CONSTRAINT task_dependencies_type_check
  CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish'));

-- ============================================
-- 5. Task completion log
-- ============================================
CREATE TABLE IF NOT EXISTS task_completion_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES service_tasks(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES auth.users(id),
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  duration_seconds INTEGER,
  notes TEXT,
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE
);

-- ============================================
-- 6. RLS Policies
-- ============================================

-- task_templates
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view task templates for their church" ON task_templates;
CREATE POLICY "Users can view task templates for their church"
  ON task_templates FOR SELECT
  USING (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage task templates for their church" ON task_templates;
CREATE POLICY "Users can manage task templates for their church"
  ON task_templates FOR ALL
  USING (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
  WITH CHECK (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()));

-- task_template_items
ALTER TABLE task_template_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view template items for their church" ON task_template_items;
CREATE POLICY "Users can view template items for their church"
  ON task_template_items FOR SELECT
  USING (template_id IN (
    SELECT id FROM task_templates WHERE church_id IN (
      SELECT church_id FROM users WHERE id = auth.uid()
    )
  ));

DROP POLICY IF EXISTS "Users can manage template items for their church" ON task_template_items;
CREATE POLICY "Users can manage template items for their church"
  ON task_template_items FOR ALL
  USING (template_id IN (
    SELECT id FROM task_templates WHERE church_id IN (
      SELECT church_id FROM users WHERE id = auth.uid()
    )
  ))
  WITH CHECK (template_id IN (
    SELECT id FROM task_templates WHERE church_id IN (
      SELECT church_id FROM users WHERE id = auth.uid()
    )
  ));

-- service_tasks
ALTER TABLE service_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view service tasks for their church" ON service_tasks;
CREATE POLICY "Users can view service tasks for their church"
  ON service_tasks FOR SELECT
  USING (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()));

DROP POLICY IF EXISTS "Users can manage service tasks for their church" ON service_tasks;
CREATE POLICY "Users can manage service tasks for their church"
  ON service_tasks FOR ALL
  USING (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
  WITH CHECK (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()));

-- task_dependencies
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view task dependencies for their church" ON task_dependencies;
CREATE POLICY "Users can view task dependencies for their church"
  ON task_dependencies FOR SELECT
  USING (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

DROP POLICY IF EXISTS "Users can create task dependencies for their church" ON task_dependencies;
CREATE POLICY "Users can create task dependencies for their church"
  ON task_dependencies FOR INSERT
  WITH CHECK (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

DROP POLICY IF EXISTS "Users can delete task dependencies for their church" ON task_dependencies;
CREATE POLICY "Users can delete task dependencies for their church"
  ON task_dependencies FOR DELETE
  USING (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

-- task_completion_log
ALTER TABLE task_completion_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view task completion logs for their church" ON task_completion_log;
CREATE POLICY "Users can view task completion logs for their church"
  ON task_completion_log FOR SELECT
  USING (church_id IN (SELECT church_id FROM churches WHERE id = church_id));

-- ============================================
-- 7. Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_task_templates_church_id ON task_templates(church_id);
CREATE INDEX IF NOT EXISTS idx_task_template_items_template_id ON task_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_service_tasks_service_id ON service_tasks(service_id);
CREATE INDEX IF NOT EXISTS idx_service_tasks_church_id ON service_tasks(church_id);
CREATE INDEX IF NOT EXISTS idx_service_tasks_assigned_member ON service_tasks(assigned_team_member_id);
CREATE INDEX IF NOT EXISTS idx_service_tasks_status ON service_tasks(status);
CREATE INDEX IF NOT EXISTS idx_service_tasks_priority ON service_tasks(priority);
CREATE INDEX IF NOT EXISTS idx_service_tasks_due_date ON service_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_service_tasks_parent ON service_tasks(parent_task_id);
CREATE INDEX IF NOT EXISTS idx_service_tasks_depends ON service_tasks(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_task_id ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_depends_on ON task_dependencies(depends_on_task_id);
CREATE INDEX IF NOT EXISTS idx_task_dependencies_church_id ON task_dependencies(church_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_task_id ON task_completion_log(task_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_service_id ON task_completion_log(service_id);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_completed_at ON task_completion_log(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_completion_log_church_id ON task_completion_log(church_id);

-- ============================================
-- 8. Functions & Triggers
-- ============================================

-- Check if a task's dependencies are met
CREATE OR REPLACE FUNCTION can_complete_task(task_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  incomplete_deps INTEGER;
BEGIN
  SELECT COUNT(*) INTO incomplete_deps
  FROM task_dependencies td
  JOIN service_tasks st ON td.depends_on_task_id = st.id
  WHERE td.task_id = task_uuid
    AND st.status != 'done';
  RETURN incomplete_deps = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get task dependencies with details
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

-- Create a task from a template item
CREATE OR REPLACE FUNCTION create_task_from_template(
  template_item_uuid UUID,
  service_uuid UUID,
  assigned_member_uuid UUID DEFAULT NULL,
  assigned_role_param TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  new_task_id UUID;
  v_church_id UUID;
  v_template_id UUID;
  v_title TEXT;
  v_default_notes TEXT;
  v_position INT;
  v_priority TEXT;
  v_estimated_duration_minutes INTEGER;
BEGIN
  SELECT tt.church_id, tti.template_id, tti.title,
         COALESCE(tti.default_notes, ''), tti.position,
         COALESCE(tti.priority, 'medium'), COALESCE(tti.estimated_duration_minutes, 0)
  INTO v_church_id, v_template_id, v_title,
       v_default_notes, v_position,
       v_priority, v_estimated_duration_minutes
  FROM task_template_items tti
  JOIN task_templates tt ON tti.template_id = tt.id
  WHERE tti.id = template_item_uuid;

  INSERT INTO service_tasks (
    service_id, church_id, template_id, title, notes,
    assigned_team_member_id, assigned_role, position, status,
    priority, estimated_duration_minutes
  )
  VALUES (
    service_uuid, v_church_id, v_template_id,
    v_title, v_default_notes,
    assigned_member_uuid, assigned_role_param, v_position, 'pending',
    v_priority, v_estimated_duration_minutes
  )
  RETURNING id INTO new_task_id;

  RETURN new_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Log task completion trigger (SECURITY DEFINER to bypass RLS on task_completion_log)
CREATE OR REPLACE FUNCTION log_task_completion()
RETURNS TRIGGER
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status != 'done' THEN
    INSERT INTO task_completion_log (task_id, service_id, completed_by, completed_at, duration_seconds, notes, church_id)
    VALUES (
      NEW.id, NEW.service_id, NEW.completed_by, NEW.completed_at,
      EXTRACT(EPOCH FROM (NEW.completed_at - NEW.created_at))::INTEGER,
      NEW.notes, NEW.church_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS task_completion_logging_trigger ON service_tasks;
CREATE TRIGGER task_completion_logging_trigger
  AFTER UPDATE OF status ON service_tasks
  FOR EACH ROW
  WHEN (NEW.status = 'done' AND OLD.status != 'done')
  EXECUTE FUNCTION log_task_completion();

-- ============================================
-- 9. View: tasks with dependencies
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

COMMENT ON TABLE task_dependencies IS 'Stores dependencies between tasks, allowing for complex task workflows';
COMMENT ON TABLE task_completion_log IS 'Audit trail of task completions for analytics and reporting';
