import { supabase } from '@/lib/supabase';
import { sanitizeString, sanitizeHtml, sanitizeObject } from '@/lib/sanitize';
import type {
  Church,
  User,
  Service,
  ServiceItem,
  Song,
  SongFile,
  TeamMember,
  ServiceAssignment,
  SongUsage,
  ServiceTemplate,
  Notification,
  Invite,
  ChatMessage,
  ChatMessagePopulated,
} from './types';

// Helper to sanitize string fields in objects before database operations
const sanitizeInput = {
  church: (c: Partial<Church>): Partial<Church> => ({
    ...c,
    name: c.name ? sanitizeString(c.name) : c.name,
    slug: c.slug ? sanitizeString(c.slug) : c.slug,
  }),
  service: (s: Partial<Service>): Partial<Service> => ({
    ...s,
    title: s.title ? sanitizeString(s.title) : s.title,
    notes: s.notes ? sanitizeHtml(s.notes) : s.notes,
    time: s.time ? sanitizeString(s.time) : s.time,
  }),
  serviceItem: (si: Partial<ServiceItem>): Partial<ServiceItem> => ({
    ...si,
    title: si.title ? sanitizeString(si.title) : si.title,
    notes: si.notes ? sanitizeHtml(si.notes) : si.notes,
    key: si.key ? sanitizeString(si.key) : si.key,
  }),
  song: (s: Partial<Song>): Partial<Song> => ({
    ...s,
    title: s.title ? sanitizeString(s.title) : s.title,
    artist: s.artist ? sanitizeString(s.artist) : s.artist,
    default_key: s.default_key ? sanitizeString(s.default_key) : s.default_key,
    ccli_number: s.ccli_number ? sanitizeString(s.ccli_number) : s.ccli_number,
    youtube_video_id: s.youtube_video_id ? sanitizeString(s.youtube_video_id) : s.youtube_video_id,
  }),
  teamMember: (tm: Partial<TeamMember>): Partial<TeamMember> => ({
    ...tm,
    name: tm.name ? sanitizeString(tm.name) : tm.name,
    email: tm.email ? sanitizeString(tm.email).toLowerCase() : tm.email,
  }),
  template: (t: Partial<ServiceTemplate>): Partial<ServiceTemplate> => ({
    ...t,
    title: t.title ? sanitizeString(t.title) : t.title,
    notes: t.notes ? sanitizeHtml(t.notes) : t.notes,
    time: t.time ? sanitizeString(t.time) : t.time,
  }),
  notification: (n: Partial<Notification>): Partial<Notification> => ({
    ...n,
    title: n.title ? sanitizeString(n.title) : n.title,
    message: n.message ? sanitizeHtml(n.message) : n.message,
  }),
  invite: (i: Partial<Invite>): Partial<Invite> => ({
    ...i,
    email: i.email ? sanitizeString(i.email).toLowerCase() : i.email,
    token: i.token ? sanitizeString(i.token) : i.token,
  }),
  chatMessage: (m: Partial<ChatMessage>): Partial<ChatMessage> => ({
    ...m,
    content: m.content ? sanitizeHtml(m.content) : m.content,
  }),
};

/**
 * CRITICAL: All getById methods MUST verify church_id to prevent cross-tenant data access.
 * This is a defense-in-depth measure. RLS policies should be the primary security layer,
 * but application-level checks provide an additional safety net.
 */

export const db = {
  // Churches
  churches: {
    getById: async (id: string, churchId?: string) => {
      const query = supabase.from('churches').select('*').eq('id', id);
      
      // If churchId is provided, verify it matches
      if (churchId) {
        query.eq('id', churchId);
      }
      
      const { data } = await query.single();
      return data as Church | null;
    },
    create: async (c: Omit<Church, 'id' | 'created_at'>) => {
      const sanitized = sanitizeInput.church(c);
      const { data } = await supabase.from('churches').insert(sanitized).select().single();
      return data as Church;
    },
  },

  // Users
  users: {
    getByEmail: async (email: string) => {
      const { data } = await supabase.from('users').select('*').ilike('email', email).single();
      return data as User | null;
    },
    getByChurch: async (churchId: string) => {
      const { data } = await supabase.from('users').select('*').eq('church_id', churchId);
      return (data || []) as User[];
    },
  },

  // Services
  services: {
    getByChurch: async (churchId: string) => {
      const { data } = await supabase.from('services').select('*').eq('church_id', churchId).order('date', { ascending: false });
      return (data || []) as Service[];
    },
    getById: async (id: string, churchId: string) => {
      const { data } = await supabase
        .from('services')
        .select('*')
        .eq('id', id)
        .eq('church_id', churchId)
        .single();
      return data as Service | null;
    },
    create: async (s: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => {
      const sanitized = sanitizeInput.service(s);
      const { data } = await supabase.from('services').insert(sanitized).select().single();
      return data as Service;
    },
    update: async (id: string, churchId: string, updates: Partial<Service>) => {
      const sanitized = sanitizeInput.service(updates);
      const { data } = await supabase
        .from('services')
        .update({ ...sanitized, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('church_id', churchId)
        .select()
        .single();
      return data as Service;
    },
    delete: async (id: string, churchId: string) => {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', id)
        .eq('church_id', churchId);
      return !error;
    },
    duplicate: async (sourceId: string, churchId: string, newDate: string, newTitle?: string) => {
      const source = await db.services.getById(sourceId, churchId);
      if (!source) {
        console.error('[Services] Duplicate failed: service not found or access denied', { sourceId, churchId });
        return null;
      }

      const { data: newService } = await supabase.from('services').insert({
        church_id: churchId,
        title: newTitle || `${source.title} (copy)`,
        date: newDate,
        time: source.time,
        status: 'draft',
        notes: source.notes,
      }).select().single();

      if (!newService) return null;

      // Copy Items
      const items = await db.serviceItems.getByService(sourceId);
      if (items.length > 0) {
        const newItems = items.map(i => ({
          service_id: newService.id,
          type: i.type,
          position: i.position,
          title: i.title,
          song_id: i.song_id,
          notes: i.notes,
          duration_minutes: i.duration_minutes,
          key: i.key,
        }));
        await supabase.from('service_items').insert(newItems);
      }

      // Copy Assignments
      const assignments = await db.assignments.getByService(sourceId, churchId);
      if (assignments.length > 0) {
        const newAssignments = assignments.map(a => ({
          service_id: newService.id,
          team_member_id: a.team_member_id,
          role: a.role,
          status: 'pending',
        }));
        await supabase.from('service_assignments').insert(newAssignments);
      }

      return newService as Service;
    },
  },

  // Service Items
  serviceItems: {
    getByService: async (serviceId: string) => {
      const { data } = await supabase.from('service_items').select('*').eq('service_id', serviceId).order('position');
      return (data || []) as ServiceItem[];
    },
    getById: async (id: string, churchId: string) => {
      // Verify the service belongs to this church
      const { data } = await supabase
        .from('service_items')
        .select('*, services(church_id)')
        .eq('id', id)
        .single();
      
      if (!data || !data.services || data.services.church_id !== churchId) {
        return null;
      }
      
      return data as ServiceItem;
    },
    create: async (si: Omit<ServiceItem, 'id'>) => {
      const sanitized = sanitizeInput.serviceItem(si);
      const { data } = await supabase.from('service_items').insert(sanitized).select().single();
      return data as ServiceItem;
    },
    update: async (id: string, churchId: string, updates: Partial<ServiceItem>) => {
      const sanitized = sanitizeInput.serviceItem(updates);
      const { data } = await supabase
        .from('service_items')
        .update(sanitized)
        .eq('id', id)
        .select('*, services(church_id)')
        .single();
      
      // Verify the service belongs to this church
      if (!data || !data.services || data.services.church_id !== churchId) {
        return null;
      }
      
      return data as ServiceItem;
    },
    delete: async (id: string, churchId: string) => {
      // First verify the item's service belongs to this church
      const { data: item } = await supabase
        .from('service_items')
        .select('service_id, services(church_id)')
        .eq('id', id)
        .single();
      
      // When joining with services, Supabase returns an array for the related table
      if (!item || !item.services) {
        console.error('[ServiceItems] Delete failed: item not found or access denied', { id, churchId });
        return false;
      }
      
      const services = item.services as Array<{ church_id: string }>;
      if (services.length === 0 || services[0].church_id !== churchId) {
        console.error('[ServiceItems] Delete failed: service church_id mismatch', { id, churchId });
        return false;
      }
      
      const { error } = await supabase.from('service_items').delete().eq('id', id);
      return !error;
    },
    reorder: async (serviceId: string, churchId: string, orderedIds: string[]) => {
      // Verify the service belongs to this church
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();
      
      if (!service || service.church_id !== churchId) {
        console.error('[ServiceItems] Reorder failed: service not found or access denied', { serviceId, churchId });
        return;
      }
      
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from('service_items').update({ position: index }).eq('id', id)
        )
      );
    },
  },

  // Songs
  songs: {
    getByChurch: async (churchId: string) => {
      const { data } = await supabase.from('songs').select('*').eq('church_id', churchId).order('title');
      return (data || []) as Song[];
    },
    getById: async (id: string, churchId: string) => {
      const { data } = await supabase
        .from('songs')
        .select('*')
        .eq('id', id)
        .eq('church_id', churchId)
        .single();
      return data as Song | null;
    },
    create: async (s: Omit<Song, 'id' | 'created_at'>) => {
      const sanitized = sanitizeInput.song(s);
      const { data } = await supabase.from('songs').insert(sanitized).select().single();
      return data as Song;
    },
    update: async (id: string, churchId: string, updates: Partial<Song>) => {
      const sanitized = sanitizeInput.song(updates);
      const { data } = await supabase
        .from('songs')
        .update(sanitized)
        .eq('id', id)
        .eq('church_id', churchId)
        .select()
        .single();
      return data as Song;
    },
    delete: async (id: string, churchId: string) => {
      const { error } = await supabase
        .from('songs')
        .delete()
        .eq('id', id)
        .eq('church_id', churchId);
      return !error;
    },
  },

  // Song Files
  songFiles: {
    getBySong: async (songId: string, churchId: string) => {
      // Verify the song belongs to this church
      const { data: song } = await supabase
        .from('songs')
        .select('church_id')
        .eq('id', songId)
        .single();
      
      if (!song || song.church_id !== churchId) {
        return [];
      }
      
      const { data } = await supabase.from('song_files').select('*').eq('song_id', songId);
      return (data || []) as SongFile[];
    },
    create: async (sf: Omit<SongFile, 'id' | 'created_at'>) => {
      const { data } = await supabase.from('song_files').insert(sf).select().single();
      return data as SongFile;
    },
    delete: async (id: string, churchId: string) => {
      // Verify the file's song belongs to this church
      const { data: file } = await supabase
        .from('song_files')
        .select('song_id, songs(church_id)')
        .eq('id', id)
        .single();
      
      // When joining with songs, Supabase returns an array for the related table
      if (!file || !file.songs) {
        console.error('[SongFiles] Delete failed: file not found or access denied', { id, churchId });
        return false;
      }
      
      const songs = file.songs as Array<{ church_id: string }>;
      if (songs.length === 0 || songs[0].church_id !== churchId) {
        console.error('[SongFiles] Delete failed: song church_id mismatch', { id, churchId });
        return false;
      }
      
      const { error } = await supabase.from('song_files').delete().eq('id', id);
      return !error;
    },
  },

  // Team Members
  teamMembers: {
    getByChurch: async (churchId: string) => {
      const { data } = await supabase.from('team_members').select('*').eq('church_id', churchId).order('name');
      return (data || []) as TeamMember[];
    },
    getById: async (id: string, churchId: string) => {
      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('id', id)
        .eq('church_id', churchId)
        .single();
      return data as TeamMember | null;
    },
    create: async (tm: Omit<TeamMember, 'id' | 'created_at'>) => {
      const sanitized = sanitizeInput.teamMember(tm);
      const { data } = await supabase.from('team_members').insert(sanitized).select().single();
      return data as TeamMember;
    },
    update: async (id: string, churchId: string, updates: Partial<TeamMember>) => {
      const sanitized = sanitizeInput.teamMember(updates);
      const { data } = await supabase
        .from('team_members')
        .update(sanitized)
        .eq('id', id)
        .eq('church_id', churchId)
        .select()
        .single();
      return data as TeamMember;
    },
    delete: async (id: string, churchId: string) => {
      const { error } = await supabase
        .from('team_members')
        .delete()
        .eq('id', id)
        .eq('church_id', churchId);
      return !error;
    },
  },

  // Service Assignments
  assignments: {
    getByService: async (serviceId: string, churchId: string) => {
      // Verify the service belongs to this church
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();
      
      if (!service || service.church_id !== churchId) {
        return [];
      }
      
      const { data } = await supabase.from('service_assignments').select('*').eq('service_id', serviceId);
      return (data || []) as ServiceAssignment[];
    },
    getByTeamMember: async (teamMemberId: string, churchId: string) => {
      // Verify the team member belongs to this church
      const { data: member } = await supabase
        .from('team_members')
        .select('church_id')
        .eq('id', teamMemberId)
        .single();
      
      if (!member || member.church_id !== churchId) {
        return [];
      }
      
      const { data } = await supabase
        .from('service_assignments')
        .select('*, service_id, services(church_id)')
        .eq('team_member_id', teamMemberId);
      
      // Filter to only assignments for this church's services
      return (data || []).filter(a => a.services && a.services.church_id === churchId) as ServiceAssignment[];
    },
    create: async (sa: Omit<ServiceAssignment, 'id'>) => {
      const { data } = await supabase.from('service_assignments').insert(sa).select().single();
      return data as ServiceAssignment;
    },
    update: async (id: string, churchId: string, updates: Partial<ServiceAssignment>) => {
      const { data } = await supabase
        .from('service_assignments')
        .update(updates)
        .eq('id', id)
        .select('*, service_id, services(church_id)')
        .single();
      
      // Verify the service belongs to this church
      if (!data || !data.services || data.services.church_id !== churchId) {
        return null;
      }
      
      return data as ServiceAssignment;
    },
    delete: async (id: string, churchId: string) => {
      // Verify the assignment's service belongs to this church
      const { data: assignment } = await supabase
        .from('service_assignments')
        .select('service_id, services(church_id)')
        .eq('id', id)
        .single();
      
      // When joining with services, Supabase returns an array for the related table
      if (!assignment || !assignment.services) {
        console.error('[Assignments] Delete failed: assignment not found or access denied', { id, churchId });
        return false;
      }
      
      const services = assignment.services as Array<{ church_id: string }>;
      if (services.length === 0 || services[0].church_id !== churchId) {
        console.error('[Assignments] Delete failed: service church_id mismatch', { id, churchId });
        return false;
      }
      
      const { error } = await supabase.from('service_assignments').delete().eq('id', id);
      return !error;
    },
    deleteByService: async (serviceId: string, churchId: string) => {
      // Verify the service belongs to this church
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();
      
      if (!service || service.church_id !== churchId) {
        console.error('[Assignments] DeleteByService failed: service not found or access denied', { serviceId, churchId });
        return false;
      }
      
      const { error } = await supabase.from('service_assignments').delete().eq('service_id', serviceId);
      return !error;
    },
  },

  // Song Usage
  songUsage: {
    getByChurch: async (churchId: string) => {
      const { data } = await supabase.from('song_usage').select('*').eq('church_id', churchId).order('date', { ascending: false });
      return (data || []) as SongUsage[];
    },
    getBySong: async (songId: string, churchId: string) => {
      // Verify the song belongs to this church
      const { data: song } = await supabase
        .from('songs')
        .select('church_id')
        .eq('id', songId)
        .single();
      
      if (!song || song.church_id !== churchId) {
        return [];
      }
      
      const { data } = await supabase.from('song_usage').select('*').eq('song_id', songId).order('date', { ascending: false });
      return (data || []) as SongUsage[];
    },
    create: async (su: Omit<SongUsage, 'id'>) => {
      const { data } = await supabase.from('song_usage').insert(su).select().single();
      return data as SongUsage;
    },
    createForService: async (serviceId: string, churchId: string, date: string) => {
      // Verify the service belongs to this church
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();
      
      if (!service || service.church_id !== churchId) {
        console.error('[SongUsage] CreateForService failed: service not found or access denied', { serviceId, churchId });
        return;
      }
      
      const items = await db.serviceItems.getByService(serviceId);
      const songItems = items.filter((i) => i.type === 'song' && i.song_id);

      if (songItems.length > 0) {
        const usages: Array<{
          church_id: string;
          service_id: string;
          song_id: string;
          date: string;
        }> = songItems.map((item) => ({
          church_id: churchId,
          service_id: serviceId,
          song_id: item.song_id!,
          date,
        }));
        await supabase.from('song_usage').insert(usages);
      }
    },
  },

  // Templates
  templates: {
    getByChurch: async (churchId: string) => {
      const { data } = await supabase.from('service_templates').select('*').eq('church_id', churchId).order('day_of_week');
      return (data || []) as ServiceTemplate[];
    },
    getById: async (id: string, churchId: string) => {
      const { data } = await supabase
        .from('service_templates')
        .select('*')
        .eq('id', id)
        .eq('church_id', churchId)
        .single();
      return data as ServiceTemplate | null;
    },
    create: async (t: Omit<ServiceTemplate, 'id' | 'created_at'>) => {
      const sanitized = sanitizeInput.template(t);
      const { data } = await supabase.from('service_templates').insert(sanitized).select().single();
      return data as ServiceTemplate;
    },
    update: async (id: string, churchId: string, updates: Partial<ServiceTemplate>) => {
      const sanitized = sanitizeInput.template(updates);
      const { data } = await supabase
        .from('service_templates')
        .update(sanitized)
        .eq('id', id)
        .eq('church_id', churchId)
        .select()
        .single();
      return data as ServiceTemplate;
    },
    delete: async (id: string, churchId: string) => {
      const { error } = await supabase
        .from('service_templates')
        .delete()
        .eq('id', id)
        .eq('church_id', churchId);
      return !error;
    },
    createServiceFromTemplate: async (templateId: string, churchId: string, dateString: string) => {
      const template = await db.templates.getById(templateId, churchId);
      if (!template) {
        console.error('[Templates] CreateServiceFromTemplate failed: template not found or access denied', { templateId, churchId });
        return null;
      }

      const { data: svc } = await supabase.from('services').insert({
        church_id: churchId,
        title: template.title,
        date: dateString,
        time: template.time,
        status: 'draft',
        notes: template.notes,
      }).select().single();

      if (!svc) return null;

      // Copy items
      if (template.items && Array.isArray(template.items) && template.items.length > 0) {
        const itemsToInsert = template.items.map((i, index) => ({
          service_id: svc.id,
          type: i.type,
          position: index,
          title: i.title,
          song_id: i.song_id,
          notes: i.notes,
          duration_minutes: i.duration_minutes,
          key: i.key,
        }));
        await supabase.from('service_items').insert(itemsToInsert);
      }

      return svc as Service;
    },
  },

  // Notifications
  notifications: {
    getByUser: async (userId: string) => {
      const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
      return (data || []) as Notification[];
    },
    getUnreadCount: async (userId: string) => {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('read', false);
      return count || 0;
    },
    markRead: async (id: string, userId: string) => {
      // Verify the notification belongs to this user
      const { data: notification } = await supabase
        .from('notifications')
        .select('user_id')
        .eq('id', id)
        .single();
      
      if (!notification || notification.user_id !== userId) {
        console.error('[Notifications] MarkRead failed: notification not found or access denied', { id, userId });
        return;
      }
      
      await supabase.from('notifications').update({ read: true }).eq('id', id);
    },
    markAllRead: async (userId: string) => {
      await supabase.from('notifications').update({ read: true }).eq('user_id', userId);
    },
    create: async (n: Omit<Notification, 'id' | 'created_at'>) => {
      const { data } = await supabase.from('notifications').insert(n).select().single();
      return data as Notification;
    },
  },

  // Invites
  invites: {
    getByToken: async (token: string, churchId?: string) => {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .is('used_at', null)
        .gt('expires_at', new Date().toISOString())
        .limit(1)
        .single();

      if (error || !data) {
        console.warn('[Invites] Invalid or expired token:', token);
        return null;
      }

      // If churchId is provided, verify it matches
      if (churchId && data.church_id !== churchId) {
        console.warn('[Invites] Invite church mismatch:', { token, inviteChurchId: data.church_id, requestChurchId: churchId });
        return null;
      }

      // The query already filters for non-expired invites (expires_at > now)
      // This additional check ensures defense-in-depth
      if (new Date(data.expires_at).getTime() < new Date().getTime()) {
        console.warn('[Invites] Expired token used:', token);
        return null;
      }

      return data as Invite | null;
    },
    markUsed: async (id: string, churchId: string) => {
      // Verify the invite belongs to this church
      const { data: invite } = await supabase
        .from('invites')
        .select('church_id')
        .eq('id', id)
        .single();
      
      if (!invite || invite.church_id !== churchId) {
        console.error('[Invites] MarkUsed failed: invite not found or access denied', { id, churchId });
        return false;
      }
      
      const { error } = await supabase
        .from('invites')
        .update({ used_at: new Date().toISOString() })
        .eq('id', id);

      return !error;
    },
    create: async (invite: Omit<Invite, 'id' | 'used_at'>) => {
      const { data, error } = await supabase
        .from('invites')
        .insert(invite)
        .select()
        .single();

      if (error) throw error;
      return data as Invite;
    },
    getByChurch: async (churchId: string) => {
      const { data } = await supabase
        .from('invites')
        .select('*')
        .eq('church_id', churchId)
        .is('used_at', null)
        .order('created_at', { ascending: false });

      return (data || []) as Invite[];
    },
    getByEmail: async (email: string, churchId?: string) => {
      let query = supabase
        .from('invites')
        .select('*')
        .eq('email', email)
        .is('used_at', null)
        .limit(1);
      
      if (churchId) {
        query = query.eq('church_id', churchId);
      }

      const { data, error } = await query.single();
      if (error || !data) return null;
      return data as Invite | null;
    },
  },

  // Helper to map Supabase chat message to ChatMessagePopulated
  mapChatMessage: (msg: any): ChatMessagePopulated => {
    const userData = msg.users;
    return {
      id: msg.id,
      church_id: msg.church_id,
      content: msg.content,
      created_at: msg.created_at,
      user_id: msg.user_id,
      user: userData ? {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        avatar_url: userData.avatar_url,
      } : { id: msg.user_id, name: 'Unknown', avatar_url: undefined },
    };
  },

  // Chat
  chat: {
    getByChurch: async (churchId: string, limit = 50, offset = 0) => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*, users(*)')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);
      
      // Reverse to show oldest first in UI and map user data
      return ((data || []) as any[]).reverse().map(db.mapChatMessage);
    },
    create: async (message: Omit<ChatMessage, 'id' | 'created_at'>) => {
      const { data } = await supabase
        .from('chat_messages')
        .insert(message)
        .select('*, users(*)')
        .single();
      return db.mapChatMessage(data);
    },
    subscribe: (churchId: string, callback: (message: ChatMessagePopulated) => void, onError?: (error: Error) => void) => {
      let channel = supabase
        .channel(`chat:${churchId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `church_id=eq.${churchId}`,
          },
          async (payload) => {
            try {
              // Fetch user data for new message
              const { data: userData } = await supabase
                .from('users')
                .select('*')
                .eq('id', payload.new.user_id)
                .single();
              
              const mappedMessage: ChatMessagePopulated = {
                id: payload.new.id as string,
                church_id: payload.new.church_id as string,
                content: payload.new.content as string,
                created_at: payload.new.created_at as string,
                user_id: payload.new.user_id as string,
                user: userData ? {
                  id: userData.id,
                  name: userData.name,
                  email: userData.email,
                  avatar_url: userData.avatar_url,
                } : { id: payload.new.user_id as string, name: 'Unknown', avatar_url: undefined },
              };
              
              callback(mappedMessage);
            } catch (error) {
              console.error('[Chat Subscribe] Error processing message:', error);
              if (onError) onError(error as Error);
            }
          }
        )
        .subscribe((status) => {
          const statusStr = String(status);
          if (statusStr === 'SUBSCRIPTION_ERROR' || statusStr === 'TIMED_OUT' || statusStr === 'CLOSED') {
            console.warn(`[Chat Subscribe] Subscription failed with status: ${statusStr}`);
            if (onError) onError(new Error(`WebSocket subscription failed: ${statusStr}`));
          }
        });

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.warn('[Chat Subscribe] Error removing channel:', error);
        }
      };
    },
  },
};