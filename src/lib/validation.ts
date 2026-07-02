// Zod validation schemas for all data models
// Provides comprehensive input validation throughout the application

import { z } from 'zod';

// ============================================================================
// Common Schemas
// ============================================================================

export const UUIDSchema = z.string().uuid();

export const EmailSchema = z
  .string()
  .email('Invalid email address')
  .min(5, 'Email too short')
  .max(254, 'Email too long')
  .transform((val) => val.toLowerCase());

export const PhoneSchema = z
  .string()
  .min(10, 'Phone number must be at least 10 digits')
  .max(20, 'Phone number too long')
  .transform((val) => val.replace(/\D/g, ''));

export const UrlSchema = z.string().url('Invalid URL');

export const DateSchema = z.coerce.date();

export const NonEmptyStringSchema = z.string().min(1, 'This field is required');

// ============================================================================
// User Schemas
// ============================================================================

export const CreateUserSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name too long'),
  church_name: z.string().min(2, 'Church name required').optional(),
});

export const UpdateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: EmailSchema.optional(),
  phone: PhoneSchema.optional(),
  avatar_url: UrlSchema.optional(),
});

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string().min(1, 'Password required'),
});

// ============================================================================
// Team Member Schemas
// ============================================================================

export const CreateTeamMemberSchema = z.object({
  name: z.string().min(2, 'Name required').max(100),
  email: EmailSchema.optional(),
  phone: PhoneSchema.optional(),
  role: z.string().min(1, 'Role required').max(50),
  positions: z.array(z.string()).min(1, 'At least one position required'),
  avatar_url: UrlSchema.optional(),
  groups: z.array(z.string()).optional(),
  notes: z.string().max(2000).optional(),
});

export const UpdateTeamMemberSchema = CreateTeamMemberSchema.partial();

export const TeamMemberFilterSchema = z.object({
  role: z.string().optional(),
  position: z.string().optional(),
  group: z.string().optional(),
  status: z.enum(['active', 'inactive']).optional(),
  search: z.string().optional(),
});

// ============================================================================
// Song Schemas
// ============================================================================

export const CreateSongSchema = z.object({
  title: z.string().min(1, 'Title required').max(200),
  artist: z.string().max(100).optional(),
  album: z.string().max(100).optional(),
  key: z.enum([
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
  ]).optional(),
  tempo: z.number().int().min(40).max(200).optional(),
  time_signature: z.enum(['4/4', '3/4', '6/8', '2/4']).optional(),
  lyrics: z.string().max(50000).optional(),
  chords: z.string().max(50000).optional(),
  ccli_number: z.string().max(20).optional(),
  tags: z.array(z.string()).max(20).optional(),
  arrangement_notes: z.string().max(5000).optional(),
});

export const UpdateSongSchema = CreateSongSchema.partial();

export const SongFilterSchema = z.object({
  key: z.enum([
    'C', 'C#', 'Db', 'D', 'D#', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'G#', 'Ab', 'A', 'A#', 'Bb', 'B'
  ]).optional(),
  tempo_min: z.number().int().min(40).max(200).optional(),
  tempo_max: z.number().int().min(40).max(200).optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
});

// ============================================================================
// Service Schemas
// ============================================================================

export const CreateServiceSchema = z.object({
  date: z.coerce.date(),
  title: z.string().min(1, 'Title required').max(200),
  description: z.string().max(1000).optional(),
  service_type: z.enum(['sunday', 'wednesday', 'special', 'rehearsal', 'other']),
  status: z.enum(['planning', 'scheduled', 'in-progress', 'completed', 'cancelled']).default('planning'),
  location: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
});

export const UpdateServiceSchema = CreateServiceSchema.partial();

export const ServiceFilterSchema = z.object({
  status: z.enum(['planning', 'scheduled', 'in-progress', 'completed', 'cancelled']).optional(),
  service_type: z.enum(['sunday', 'wednesday', 'special', 'rehearsal', 'other']).optional(),
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  search: z.string().optional(),
});

// ============================================================================
// Assignment Schemas
// ============================================================================

export const CreateAssignmentSchema = z.object({
  service_id: UUIDSchema,
  member_id: UUIDSchema,
  position: z.string().min(1, 'Position required').max(50),
  status: z.enum(['pending', 'confirmed', 'declined', 'completed']).default('pending'),
  notes: z.string().max(1000).optional(),
});

export const UpdateAssignmentSchema = z.object({
  position: z.string().min(1).max(50).optional(),
  status: z.enum(['pending', 'confirmed', 'declined', 'completed']).optional(),
  notes: z.string().max(1000).optional(),
});

export const BulkAssignmentSchema = z.object({
  service_id: UUIDSchema,
  member_ids: z.array(UUIDSchema).min(1, 'At least one member required'),
  position: z.string().min(1, 'Position required').max(50),
});

// ============================================================================
// Task Schemas
// ============================================================================

export const CreateTaskSchema = z.object({
  title: z.string().min(1, 'Title required').max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
  status: z.enum(['todo', 'in-progress', 'review', 'done']).default('todo'),
  due_date: z.coerce.date().optional(),
  assignee_id: UUIDSchema.optional(),
  service_id: UUIDSchema.optional(),
  tags: z.array(z.string()).max(10).optional(),
  depends_on: z.array(UUIDSchema).optional(),
  estimated_hours: z.number().min(0).max(100).optional(),
});

export const UpdateTaskSchema = CreateTaskSchema.partial();

export const TaskFilterSchema = z.object({
  status: z.enum(['todo', 'in-progress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assignee_id: UUIDSchema.optional(),
  service_id: UUIDSchema.optional(),
  due_from: z.coerce.date().optional(),
  due_to: z.coerce.date().optional(),
  tag: z.string().optional(),
  search: z.string().optional(),
});

// ============================================================================
// Template Schemas
// ============================================================================

export const CreateTemplateSchema = z.object({
  name: z.string().min(1, 'Name required').max(100),
  description: z.string().max(500).optional(),
  service_type: z.enum(['sunday', 'wednesday', 'special', 'rehearsal', 'other']),
  song_ids: z.array(UUIDSchema).optional(),
  assignments: z.array(z.object({
    position: z.string().min(1).max(50),
    count: z.number().int().min(1).max(50),
  })).optional(),
  notes: z.string().max(5000).optional(),
});

export const UpdateTemplateSchema = CreateTemplateSchema.partial();

// ============================================================================
// Message/Chat Schemas
// ============================================================================

export const CreateMessageSchema = z.object({
  channel_id: UUIDSchema,
  content: z.string().min(1, 'Message required').max(10000),
  service_id: UUIDSchema.optional(),
  is_announcement: z.boolean().default(false),
});

export const CreateChannelSchema = z.object({
  name: z.string().min(1, 'Name required').max(100),
  description: z.string().max(500).optional(),
  type: z.enum(['general', 'service', 'announcement', 'direct']).default('general'),
  service_id: UUIDSchema.optional(),
  member_ids: z.array(UUIDSchema).optional(),
});

// ============================================================================
// Notification Schemas
// ============================================================================

export const CreateNotificationSchema = z.object({
  recipient_id: UUIDSchema,
  type: z.enum([
    'assignment',
    'message',
    'update',
    'reminder',
    'announcement',
    'system',
  ]),
  title: z.string().min(1, 'Title required').max(200),
  message: z.string().min(1, 'Message required').max(5000),
  action_url: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const NotificationSettingsSchema = z.object({
  email_enabled: z.boolean().default(true),
  sms_enabled: z.boolean().default(false),
  assignment_reminders: z.boolean().default(true),
  service_updates: z.boolean().default(true),
  message_notifications: z.boolean().default(true),
  announcement_notifications: z.boolean().default(true),
  reminder_hours_before: z.array(z.number().int()).default([24, 48]),
});

// ============================================================================
// Reminder Schemas
// ============================================================================

export const CreateReminderSchema = z.object({
  assignment_id: UUIDSchema,
  scheduled_at: z.coerce.date(),
  method: z.enum(['email', 'sms', 'both']).default('email'),
  status: z.enum(['pending', 'sent', 'failed']).default('pending'),
});

// ============================================================================
// File/Attachment Schemas
// ============================================================================

export const FileAttachmentSchema = z.object({
  song_id: UUIDSchema,
  filename: z.string().min(1).max(255),
  file_type: z.enum(['pdf', 'doc', 'docx', 'mp3', 'wav', 'image', 'other']),
  file_size: z.number().int().positive().max(50 * 1024 * 1024), // Max 50MB
  mime_type: z.string().max(100),
  storage_path: z.string().min(1),
});

// ============================================================================
// Billing/Subscription Schemas
// ============================================================================

export const CreateCheckoutSessionSchema = z.object({
  price_id: z.string().min(1),
  success_url: z.string().url(),
  cancel_url: z.string().url(),
  customer_email: EmailSchema.optional(),
});

export const UpdateSubscriptionSchema = z.object({
  price_id: z.string().min(1).optional(),
  quantity: z.number().int().min(1).optional(),
  cancel_at_period_end: z.boolean().optional(),
});

// ============================================================================
// Report/Analytics Schemas
// ============================================================================

export const ReportFilterSchema = z.object({
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  service_type: z.enum(['sunday', 'wednesday', 'special', 'rehearsal', 'other']).optional(),
  group_by: z.enum(['day', 'week', 'month', 'service_type', 'member']).optional(),
  include_archived: z.boolean().default(false),
});

export const MemberStatsFilterSchema = z.object({
  date_from: z.coerce.date().optional(),
  date_to: z.coerce.date().optional(),
  member_id: UUIDSchema.optional(),
  group: z.string().optional(),
});

// ============================================================================
// Search Schemas
// ============================================================================

export const AdvancedSearchSchema = z.object({
  query: z.string().min(1, 'Search query required'),
  type: z.enum(['songs', 'members', 'services', 'tasks', 'all']).default('all'),
  filters: z.object({
    date_from: z.coerce.date().optional(),
    date_to: z.coerce.date().optional(),
    status: z.array(z.string()).optional(),
    tags: z.array(z.string()).optional(),
    assignee: z.string().optional(),
    priority: z.array(z.enum(['low', 'medium', 'high', 'urgent'])).optional(),
  }).optional(),
  sort_by: z.enum(['relevance', 'date', 'name', 'priority']).default('relevance'),
  sort_order: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Validate data against a schema and return the result
 */
export async function validateData<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; error: z.ZodError }> {
  try {
    const validated = await schema.parseAsync(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error };
    }
    throw error;
  }
}

/**
 * Format Zod error for user-friendly display
 */
export function formatZodError(error: z.ZodError): string {
  const issues = error.issues.map((issue) => {
    const path = issue.path.join('.');
    const message = issue.message;
    return path ? `${path}: ${message}` : message;
  });
  return issues.join(', ');
}

/**
 * Create API response from validation result
 */
export function createValidationResponse<T>(
  result: { success: true; data: T } | { success: false; error: z.ZodError }
): Response {
  if (!result.success) {
    return Response.json(
      {
        error: 'Validation failed',
        details: result.error.issues,
        message: formatZodError(result.error),
      },
      { status: 400 }
    );
  }
  return Response.json({ success: true, data: result.data });
}
