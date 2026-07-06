-- 046_channel_management.sql
-- ============================================================
-- Channel management enhancements: realtime subscriptions,
-- auto-add creator to private channels, additional RLS policies
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. Add chat_channels and chat_channel_members to realtime
-- ─────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE chat_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_channel_members;

-- ─────────────────────────────────────────────────────────────
-- 2. Auto-add channel creator as a member for private channels
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auto_add_channel_creator()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_private AND NEW.created_by IS NOT NULL THEN
    INSERT INTO chat_channel_members (channel_id, user_id)
    VALUES (NEW.id, NEW.created_by)
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS auto_add_channel_creator_trigger ON chat_channels;
CREATE TRIGGER auto_add_channel_creator_trigger
  AFTER INSERT ON chat_channels
  FOR EACH ROW
  EXECUTE FUNCTION auto_add_channel_creator();
