// WorshipCenter — Core Data Models
// These types mirror the database schema and are shared across all layers.

export type UserRole = 'admin' | 'leader' | 'team';
export type ServiceStatus = 'draft' | 'finalized' | 'completed';
export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'skipped';
export type TaskRecurrence = 'one_off' | 'per_service' | 'weekly';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type ServiceItemType = 'song' | 'segment';
export type AssignmentStatus = 'pending' | 'confirmed' | 'declined';
export type SongFileType = 'chord_chart' | 'lyrics' | 'lead_sheet' | 'audio' | 'pdf' | 'image' | 'other';

export interface Church {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface User {
  id: string;
  church_id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar_url?: string;
  phone?: string;
  phone_verified?: boolean;
  team_member_id?: string | null;
  created_at: string;
}

// Song Version Types
export interface SongVersion {
  id: string;
  song_id: string;
  version_number: number;
  title: string;
  artist: string | null;
  default_key: string | null;
  ccli_number: string | null;
  tags: string[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
  church_id: string;
}

// Song Arrangement Types
export interface SongArrangement {
  id: string;
  song_id: string;
  name: string;
  key: string;
  tempo: number | null;
  time_signature: string;
  structure: SongSection[];
  notes: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  church_id: string;
}

export interface SongSection {
  section: string; // e.g., "Verse 1", "Chorus", "Bridge"
  duration: number; // in seconds
  notes?: string;
}

// Song History Types
export interface SongHistory {
  id: string;
  song_id: string;
  action: 'created' | 'updated' | 'deleted' | 'version_created' | 'arrangement_created' | 'restored_from_version';
  changed_by: string | null;
  old_data: any;
  new_data: any;
  created_at: string;
  church_id: string;
}

export interface Invite {
  id: string;
  church_id: string;
  email: string;
  role: 'admin' | 'leader' | 'team';
  token: string;
  expires_at: string;
  used_at: string | null;
}

export interface Service {
  id: string;
  church_id: string;
  title: string;
  date: string;        // ISO date string YYYY-MM-DD
  time: string;        // HH:mm
  status: ServiceStatus;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface ServiceItem {
  id: string;
  service_id: string;
  type: ServiceItemType;
  position: number;
  title: string;
  song_id: string | null;
  notes: string;
  duration_minutes: number | null;
  key: string | null;   // For songs — can override default_key
  assigned_to?: string | null;  // Optional - who is doing this segment (informational only, no notifications)
  actual_duration_seconds?: number | null;  // Captured during Service Mode
}

export interface Song {
  id: string;
  church_id: string;
  title: string;
  artist: string;
  default_key: string;
  ccli_number: string;
  tags: string[];
  youtube_video_id?: string;
  created_at: string;
}

// Song with Details
export interface SongWithDetails extends Song {
  versions: SongVersion[];
  arrangements: SongArrangement[];
  files: SongFile[];
  search_vector?: any; // tsvector type
}

export interface SongFile {
  id: string;
  song_id: string;
  file_url: string;
  file_name: string;
  type: SongFileType;
  file_size: number | null;
  mime_type: string | null;
  arrangement_id: string | null;
  version_id: string | null;
  is_primary: boolean;
  uploaded_by: string | null;
  created_at: string;
}

export interface TeamMember {
  id: string;
  church_id: string;
  name: string;
  email: string;
  phone: string;
  roles: string[];
  user_id?: string;
  avatar_url?: string;
  created_at: string;
}

export interface TeamMemberPreference {
  id: string;
  team_member_id: string;
  church_id: string;
  max_weekly_frequency: number | null;
  availability_notes: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberBlockoutDate {
  id: string;
  team_member_id: string;
  church_id: string;
  start_date: string;
  end_date: string;
  reason: string;
  created_at: string;
}

export interface ServiceAssignment {
  id: string;
  service_id: string;
  team_member_id: string;
  role: string;
  status: AssignmentStatus;
  created_at?: string;
  updated_at?: string;
  confirmed_at?: string;
  declined_at?: string;
}

export interface SongUsage {
  id: string;
  church_id: string;
  service_id: string;
  song_id: string;
  date: string;
}

export interface Notification {
  id: string;
  church_id: string;
  user_id: string;
  type: 'invitation' | 'status_change' | 'service_reminder' | 'general' | 'assignment_created' | 'assignment_reminder' | 'assignment_changed' | 'assignment_declined' | 'initial_reminder' | 'pre_rehearsal_reminder' | 'pre_service_reminder' | 'escalation' | 'debrief_request' | 'plan_change';
  title: string;
  message: string;
  read: boolean;
  service_id?: string;
  assignment_id?: string;
  link_url?: string;
  sent_at?: string;
  channels_sent?: {
    in_app: boolean;
    email: boolean;
    sms: boolean;
    push: boolean;
  };
  created_at: string;
}

export interface ServiceTemplate {
  id: string;
  church_id: string;
  title: string;
  time: string;
  day_of_week: number; // 0=Sun, 1=Mon, ...
  items: Omit<ServiceItem, 'id' | 'service_id'>[];
  roles: string[];
  notes?: string;
  created_at: string;
}

// Populated variants for UI display
export interface ServiceItemPopulated extends ServiceItem {
  song?: Song;
}

export interface ServiceAssignmentPopulated extends ServiceAssignment {
  team_member?: TeamMember;
}

export interface SongWithUsage extends Song {
  last_used: string | null;
  times_used: number;
}

export interface TeamMemberWithSchedule extends TeamMember {
  last_scheduled: string | null;
}

// Subscription & Billing Types
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete';

export interface Subscription {
  id: string;
  church_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  trial_start: string;
  trial_end: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  price_type: 'monthly' | 'yearly' | null;
  canceled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingState {
  isTrialing: boolean;
  daysRemaining: number;
  isActive: boolean;
  isPastDue: boolean;
  isCanceled: boolean;
  subscription: Subscription | null;
}

// Chat Types
export interface ChatMessage {
  id: string;
  church_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

// Chat user info for display (subset of User/TeamMember fields)
export interface ChatUserInfo {
  id: string;
  name: string;
  email?: string;
  avatar_url?: string;
}

export interface ChatMessagePopulated extends ChatMessage {
  user: ChatUserInfo;
}

// Service Chat Types
export interface ServiceChat {
  id: string;
  service_id: string;
  church_id: string;
  created_at: string;
}

export interface ServiceChatMessage {
  id: string;
  chat_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface ServiceChatMessagePopulated extends ServiceChatMessage {
  user: ChatUserInfo;
}

// Reminder Settings Types
export interface ReminderSettings {
  id: string;
  church_id: string;
  initial_reminder_hours: number;
  pre_rehearsal_reminder_hours: number;
  pre_service_reminder_hours: number;
  escalation_hours: number;
  created_at: string;
  updated_at: string;
}

// Notification Channel Types
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'push';
export type NotificationChannels = {
  in_app: boolean;
  email: boolean;
  sms: boolean;
  push: boolean;
};

// ─── Tasks & Checklists ──────────────────────────────────────────────

export interface TaskTemplate {
  id: string;
  church_id: string;
  name: string;
  description: string;
  recurrence: TaskRecurrence;
  role_scope: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskTemplateItem {
  id: string;
  template_id: string;
  title: string;
  position: number;
  is_required: boolean;
}

export interface ServiceTask {
  id: string;
  service_id: string;
  church_id: string;
  template_id: string | null;
  title: string;
  notes: string;
  assigned_team_member_id: string | null;
  assigned_role: string | null;
  position: number;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string | null;
  depends_on_task_id: string | null;
  completed_at: string | null;
  completed_by: string | null;
  due_offset_minutes: number | null;
  created_at: string;
}

// Populated variants
export interface ServiceTaskPopulated extends ServiceTask {
  assigned_member?: TeamMember;
}

export interface TaskTemplateWithItems extends TaskTemplate {
  items: TaskTemplateItem[];
}

// ─── Member Groups / Bands ───────────────────────────────────────────

export interface MemberGroup {
  id: string;
  church_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberGroupMember {
  group_id: string;
  team_member_id: string;
  role: string | null;
  joined_at: string;
}

export interface MemberGroupWithMembers extends MemberGroup {
  members: TeamMember[];
}

// ─── Team Member Private Notes ───────────────────────────────────────

export interface TeamMemberNote {
  id: string;
  team_member_id: string;
  author_user_id: string | null;
  note: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMemberNotePopulated extends TeamMemberNote {
  author?: ChatUserInfo;
}

// ─── Chat Channels ───────────────────────────────────────────────────

export type ChatChannelType = 'channel' | 'group';

export interface ChatChannel {
  id: string;
  church_id: string;
  name: string;
  description: string | null;
  type: ChatChannelType;
  is_private: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatChannelMessage {
  id: string;
  channel_id: string;
  user_id: string;
  content: string;
  created_at: string;
}

export interface ChatChannelMessagePopulated extends ChatChannelMessage {
  user: ChatUserInfo;
}

// ─── Rehearsal Tracking ─────────────────────────────────────────────

export interface RehearsalLog {
  id: string;
  church_id: string;
  service_id: string;
  team_member_id: string;
  song_id: string;
  rehearsed: boolean;
  rehearsed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RehearsalStats {
  team_member_id: string;
  member_name: string;
  member_role: string;
  rehearsed_count: number;
  total_songs: number;
}

// ─── Service Debrief / Retrospective ───────────────────────────────

export interface ServiceDebrief {
  id: string;
  service_id: string;
  user_id: string;
  church_id: string;
  rating_engagement: number; // 1-5
  rating_flow: number;       // 1-5
  rating_tech: number;       // 1-5
  what_went_well: string;
  what_broke: string;
  what_to_change: string;
  saw_god_working: string;
  timing_data: TimingComparisonItem[];
  created_at: string;
  updated_at: string;
}

export interface ServiceDebriefPopulated extends ServiceDebrief {
  user: ChatUserInfo;
}

export interface TimingComparisonItem {
  item_id: string;
  title: string;
  type: ServiceItemType;
  planned_seconds: number | null;
  actual_seconds: number | null;
}

export interface DebriefTrends {
  avg_engagement: number;
  avg_flow: number;
  avg_tech: number;
  total_debriefs: number;
  period: string; // e.g., "2026-06" for monthly grouping
}

// ─── Service Live Sessions ───────────────────────────────────────────

export interface ServiceLiveSession {
  id: string;
  service_id: string;
  church_id: string;
  current_item_id: string | null;
  current_index: number;
  elapsed_ms: number;
  is_paused: boolean;
  is_live: boolean;
  controlled_by: string | null;
  started_at: string | null;
  updated_at: string;
}

export interface LiveStateMessage {
  type: 'state_update' | 'heartbeat' | 'service_ended';
  sessionId: string;
  currentIndex?: number;
  currentItemId?: string | null;
  elapsedMs?: number;
  isPaused?: boolean;
  timestamp: number;
}