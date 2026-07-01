-- Task & Checklist tables for service-day operations
-- Allows worship leaders to create one-off tasks and reusable checklist templates

-- Task/checklist templates (reusable)
CREATE TABLE IF NOT EXISTS task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  recurrence TEXT DEFAULT 'one_off',   -- 'one_off' | 'per_service' | 'weekly'
  role_scope TEXT,                      -- optional: auto-assign to a role
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Items within a template
CREATE TABLE IF NOT EXISTS task_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  is_required BOOLEAN NOT NULL DEFAULT TRUE
);

-- Instantiated tasks attached to a specific service
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
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | in_progress | done | skipped
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  due_offset_minutes INT,                   -- minutes relative to service start
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_tasks ENABLE ROW LEVEL SECURITY;

-- task_templates: church-scoped access
CREATE POLICY "Users can view task templates for their church"
  ON task_templates FOR SELECT
  USING (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage task templates for their church"
  ON task_templates FOR ALL
  USING (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
  WITH CHECK (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()));

-- task_template_items: access via parent template
CREATE POLICY "Users can view template items for their church"
  ON task_template_items FOR SELECT
  USING (template_id IN (
    SELECT id FROM task_templates WHERE church_id IN (
      SELECT church_id FROM users WHERE id = auth.uid()
    )
  ));

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

-- service_tasks: church-scoped access
CREATE POLICY "Users can view service tasks for their church"
  ON service_tasks FOR SELECT
  USING (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can manage service tasks for their church"
  ON service_tasks FOR ALL
  USING (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()))
  WITH CHECK (church_id IN (SELECT church_id FROM users WHERE id = auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_task_templates_church_id ON task_templates(church_id);
CREATE INDEX IF NOT EXISTS idx_task_template_items_template_id ON task_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_service_tasks_service_id ON service_tasks(service_id);
CREATE INDEX IF NOT EXISTS idx_service_tasks_church_id ON service_tasks(church_id);
CREATE INDEX IF NOT EXISTS idx_service_tasks_assigned_member ON service_tasks(assigned_team_member_id);
CREATE INDEX IF NOT EXISTS idx_service_tasks_status ON service_tasks(status);