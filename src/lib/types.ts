// WorshipCenter — Core Data Models
// These types mirror the database schema and are shared across all layers.

export type UserRole = 'admin' | 'leader' | 'team';
export type ServiceStatus = 'draft' | 'finalized' | 'completed';

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
  created_at: string;
}
export type ServiceItemType = 'song' | 'segment';
export type AssignmentStatus = 'pending' | 'confirmed' | 'declined';
export type SongFileType = 'chord_chart';

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

export interface SongFile {
  id: string;
  song_id: string;
  file_url: string;
  file_name: string;
  type: SongFileType;
  created_at: string;
}

export interface TeamMember {
  id: string;
  church_id: string;
  name: string;
  email: string;
  phone: string;
  roles: string[];
  created_at: string;
}

export interface ServiceAssignment {
  id: string;
  service_id: string;
  team_member_id: string;
  role: string;
  status: AssignmentStatus;
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
  type: 'invitation' | 'status_change' | 'service_reminder' | 'general';
  title: string;
  message: string;
  read: boolean;
  service_id?: string;
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
}

export interface ChatMessagePopulated extends ChatMessage {
  user: ChatUserInfo;
}
