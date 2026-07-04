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
  ServiceAssignmentPopulated,
  SongUsage,
  ServiceTemplate,
  Notification,
  Invite,
  ChatMessage,
  ChatMessagePopulated,
  ServiceTask,
  TaskTemplate,
  TaskTemplateItem,
  SongVersion,
  SongArrangement,
  SongHistory,
  RehearsalLog,
  RehearsalStats,
  ServiceDebrief,
  ServiceDebriefPopulated,
  TimingComparisonItem,
  DebriefTrends,
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
    assigned_to: si.assigned_to ? sanitizeString(si.assigned_to) : si.assigned_to,
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
  debrief: (d: Partial<ServiceDebrief>): Partial<ServiceDebrief> => ({
    ...d,
    what_went_well: d.what_went_well ? sanitizeHtml(d.what_went_well) : d.what_went_well,
    what_broke: d.what_broke ? sanitizeHtml(d.what_broke) : d.what_broke,
    what_to_change: d.what_to_change ? sanitizeHtml(d.what_to_change) : d.what_to_change,
    saw_god_working: d.saw_god_working ? sanitizeHtml(d.saw_god_working) : d.saw_god_working,
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
          assigned_to: i.assigned_to,
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
      
      const { data } = await supabase
        .from('song_files')
        .select('*')
        .eq('song_id', songId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: false });
      return (data || []) as SongFile[];
    },
    create: async (sf: Omit<SongFile, 'id' | 'created_at'>) => {
      const { data } = await supabase.from('song_files').insert(sf).select().single();
      return data as SongFile;
    },
    update: async (id: string, churchId: string, updates: Partial<SongFile>) => {
      const { data } = await supabase
        .from('song_files')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
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
    setPrimary: async (id: string, songId: string, churchId: string) => {
      // Unset other primaries for this song
      await supabase
        .from('song_files')
        .update({ is_primary: false })
        .eq('song_id', songId)
        .eq('is_primary', true);
      // Set the new primary
      const { data } = await supabase
        .from('song_files')
        .update({ is_primary: true })
        .eq('id', id)
        .select()
        .single();
      return data as SongFile;
    },
  },

  // Song Versions
  songVersions: {
    getBySong: async (songId: string, churchId: string) => {
      const { data: song } = await supabase
        .from('songs')
        .select('church_id')
        .eq('id', songId)
        .single();
      if (!song || song.church_id !== churchId) return [];

      const { data } = await supabase
        .from('song_versions')
        .select('*')
        .eq('song_id', songId)
        .order('version_number', { ascending: false });
      return (data || []) as SongVersion[];
    },
    getById: async (id: string, churchId: string) => {
      const { data } = await supabase
        .from('song_versions')
        .select('*')
        .eq('id', id)
        .eq('church_id', churchId)
        .single();
      return data as SongVersion | null;
    },
    create: async (sv: Omit<SongVersion, 'id' | 'created_at'>) => {
      // Get the max version number for this song
      const { data: existing } = await supabase
        .from('song_versions')
        .select('version_number')
        .eq('song_id', sv.song_id)
        .order('version_number', { ascending: false })
        .limit(1);
      
      const nextVersion = (existing && existing.length > 0 ? existing[0].version_number : 0) + 1;
      
      const { data } = await supabase
        .from('song_versions')
        .insert({ ...sv, version_number: nextVersion })
        .select()
        .single();
      return data as SongVersion;
    },
    restore: async (songId: string, versionNumber: number, churchId: string) => {
      const { data, error } = await supabase
        .rpc('restore_song_from_version', { 
          song_uuid: songId, 
          version_num: versionNumber 
        });
      if (error) {
        console.error('[SongVersions] Restore failed:', error);
        return null;
      }
      return data;
    },
    delete: async (id: string, churchId: string) => {
      const { error } = await supabase
        .from('song_versions')
        .delete()
        .eq('id', id)
        .eq('church_id', churchId);
      return !error;
    },
  },

  // Song Arrangements
  songArrangements: {
    getBySong: async (songId: string, churchId: string) => {
      const { data: song } = await supabase
        .from('songs')
        .select('church_id')
        .eq('id', songId)
        .single();
      if (!song || song.church_id !== churchId) return [];

      const { data } = await supabase
        .from('song_arrangements')
        .select('*')
        .eq('song_id', songId)
        .order('is_default', { ascending: false })
        .order('name', { ascending: true });
      return (data || []) as SongArrangement[];
    },
    getById: async (id: string, churchId: string) => {
      const { data } = await supabase
        .from('song_arrangements')
        .select('*')
        .eq('id', id)
        .eq('church_id', churchId)
        .single();
      return data as SongArrangement | null;
    },
    create: async (sa: Omit<SongArrangement, 'id' | 'created_at' | 'updated_at'>) => {
      const { data } = await supabase
        .from('song_arrangements')
        .insert({
          ...sa,
          structure: sa.structure || [],
        })
        .select()
        .single();
      return data as SongArrangement;
    },
    update: async (id: string, churchId: string, updates: Partial<SongArrangement>) => {
      const { data } = await supabase
        .from('song_arrangements')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('church_id', churchId)
        .select()
        .single();
      return data as SongArrangement;
    },
    delete: async (id: string, churchId: string) => {
      const { error } = await supabase
        .from('song_arrangements')
        .delete()
        .eq('id', id)
        .eq('church_id', churchId);
      return !error;
    },
    setDefault: async (id: string, songId: string, churchId: string) => {
      // Unset other defaults for this song
      await supabase
        .from('song_arrangements')
        .update({ is_default: false })
        .eq('song_id', songId)
        .eq('is_default', true);
      // Set the new default
      const { data } = await supabase
        .from('song_arrangements')
        .update({ is_default: true })
        .eq('id', id)
        .select()
        .single();
      return data as SongArrangement;
    },
  },

  // Song History
  songHistory: {
    getBySong: async (songId: string, churchId: string) => {
      const { data: song } = await supabase
        .from('songs')
        .select('church_id')
        .eq('id', songId)
        .single();
      if (!song || song.church_id !== churchId) return [];

      const { data } = await supabase
        .from('song_history')
        .select('*')
        .eq('song_id', songId)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data || []) as SongHistory[];
    },
    getByChurch: async (churchId: string) => {
      const { data } = await supabase
        .from('song_history')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false })
        .limit(100);
      return (data || []) as SongHistory[];
    },
  },

  // Song Search (Advanced)
  songSearch: {
    search: async (churchId: string, query: string, filters?: {
      tags?: string[];
      key?: string;
      artist?: string;
      limit?: number;
    }) => {
      let queryBuilder = supabase
        .from('songs')
        .select('*')
        .eq('church_id', churchId);

      if (query.trim()) {
        // Use full-text search
        queryBuilder = queryBuilder.textSearch('search_vector', query.trim(), {
          type: 'websearch',
          config: 'english',
        });
      }

      if (filters?.tags && filters.tags.length > 0) {
        queryBuilder = queryBuilder.overlaps('tags', filters.tags);
      }
      if (filters?.key) {
        queryBuilder = queryBuilder.eq('default_key', filters.key);
      }
      if (filters?.artist) {
        queryBuilder = queryBuilder.ilike('artist', `%${filters.artist}%`);
      }

      const limit = filters?.limit || 50;
      queryBuilder = queryBuilder.limit(limit);

      const { data, error } = await queryBuilder.order('title');
      if (error) {
        console.error('[SongSearch] Search failed:', error);
        // Fall back to basic ILIKE search
        const { data: fallbackData } = await supabase
          .from('songs')
          .select('*')
          .eq('church_id', churchId)
          .or(`title.ilike.%${query}%,artist.ilike.%${query}%`)
          .order('title')
          .limit(limit);
        return (fallbackData || []) as Song[];
      }
      return (data || []) as Song[];
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
    bulkCreate: async (
      members: Array<Omit<TeamMember, 'id' | 'created_at'>>,
      churchId: string
    ) => {
      if (!members.length) return [];
      const rows = members.map((m) => ({
        ...sanitizeInput.teamMember(m),
        church_id: churchId,
      }));
      const { data, error } = await supabase
        .from('team_members')
        .insert(rows)
        .select();
      if (error) {
        console.error('[TeamMembers] BulkCreate failed', error);
        return [];
      }
      return (data || []) as TeamMember[];
    },
    bulkUpdate: async (
      updates: Array<{ id: string; data: Partial<TeamMember> }>,
      churchId: string
    ) => {
      // Supabase doesn't support batch updates with different values in one query
      const results = await Promise.all(
        updates.map((u) => db.teamMembers.update(u.id, churchId, u.data))
      );
      return results.filter((r) => r !== null) as TeamMember[];
    },
    bulkDelete: async (ids: string[], churchId: string) => {
      if (!ids.length) return 0;
      const { data, error } = await supabase
        .from('team_members')
        .delete()
        .in('id', ids)
        .eq('church_id', churchId)
        .select('id');
      return (data || []).length;
    },
    bulkAssignRole: async (ids: string[], churchId: string, role: string) => {
      if (!ids.length) return [];
      const { data, error } = await supabase
        .from('team_members')
        .update({ role })
        .in('id', ids)
        .eq('church_id', churchId)
        .select();
      if (error) {
        console.error('[TeamMembers] BulkAssignRole failed', error);
        return [];
      }
      return (data || []) as TeamMember[];
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
    report: async (messageId: string, churchId: string, reportedBy: string, reason: string) => {
      const { data, error } = await supabase
        .from('chat_reports')
        .insert({
          message_id: messageId,
          church_id: churchId,
          reported_by: reportedBy,
          reason,
        })
        .select()
        .single();

      if (error) {
        console.error('[Chat] Report failed:', error);
        throw error;
      }
      return data;
    },
  },

  // Service Chat
  serviceChat: {
    // Get or create service chat
    getOrCreate: async (serviceId: string, churchId: string) => {
      // Verify service belongs to church
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();

      if (!service || service.church_id !== churchId) {
        console.error('[ServiceChat] GetOrCreate failed: service not found or access denied', { serviceId, churchId });
        return null;
      }

      // Try to get existing chat
      const { data: existingChat } = await supabase
        .from('service_chats')
        .select('*')
        .eq('service_id', serviceId)
        .maybeSingle();

      if (existingChat) {
        return existingChat;
      }

      // Create new chat (include church_id — required NOT NULL column)
      const { data: newChat, error } = await supabase
        .from('service_chats')
        .insert({ service_id: serviceId, church_id: churchId })
        .select()
        .single();

      if (error) {
        // Race condition: another request may have created it concurrently
        const { data: fallback } = await supabase
          .from('service_chats')
          .select('*')
          .eq('service_id', serviceId)
          .maybeSingle();
        return fallback;
      }

      return newChat;
    },

    // Get messages for a service chat
    getMessages: async (serviceId: string, churchId: string) => {
      // Verify service belongs to church
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();

      if (!service || service.church_id !== churchId) {
        console.error('[ServiceChat] GetMessages failed: service not found or access denied', { serviceId, churchId });
        return [];
      }

      // Get chat ID
      const { data: chat } = await supabase
        .from('service_chats')
        .select('id')
        .eq('service_id', serviceId)
        .maybeSingle();

      if (!chat) {
        return [];
      }

      // Get messages (join users table — schema uses user_id, not sender_user_id)
      const { data, error } = await supabase
        .from('service_chat_messages')
        .select('*, users!inner(id, name, avatar_url)')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[ServiceChat] GetMessages query failed:', error);
        return [];
      }

      return (data || []).map((msg: any) => ({
        id: msg.id,
        chat_id: msg.chat_id,
        content: msg.content,
        created_at: msg.created_at,
        sender_user_id: msg.user_id,
        read_at: msg.read_at ?? null,
        sender: {
          id: msg.users.id,
          name: msg.users.name,
          avatar_url: msg.users.avatar_url,
        },
      }));
    },

    // Create a message
    createMessage: async (serviceId: string, churchId: string, senderUserId: string, content: string) => {
      // Verify service belongs to church
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();

      if (!service || service.church_id !== churchId) {
        console.error('[ServiceChat] CreateMessage failed: service not found or access denied', { serviceId, churchId });
        return null;
      }

      // Get or create chat
      const chat = await db.serviceChat.getOrCreate(serviceId, churchId);
      if (!chat) {
        return null;
      }

      // Create message (schema uses user_id, not sender_user_id)
      const { data, error } = await supabase
        .from('service_chat_messages')
        .insert({
          chat_id: chat.id,
          user_id: senderUserId,
          content: sanitizeInput.chatMessage({ content }).content,
        })
        .select('*, users(id, name, avatar_url)')
        .single();

      if (error) {
        console.error('[ServiceChat] CreateMessage insert failed:', error);
        return null;
      }

      return data ? {
        id: data.id,
        chat_id: data.chat_id,
        content: data.content,
        created_at: data.created_at,
        sender_user_id: data.user_id,
        read_at: data.read_at ?? null,
        sender: {
          id: data.users.id,
          name: data.users.name,
          avatar_url: data.users.avatar_url,
        },
      } : null;
    },

    // Subscribe to new messages
    subscribe: (serviceId: string, churchId: string, callback: (message: any) => void, onError?: (error: Error) => void) => {
      const channelName = `service-chat:${serviceId}`;
      let channel = supabase.channel(channelName);

      // Get chat ID first
      db.serviceChat.getOrCreate(serviceId, churchId).then((chat) => {
        if (!chat) return;

        channel
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'service_chat_messages',
              filter: `chat_id=eq.${chat.id}`,
            },
            async (payload) => {
              try {
                const { data: userData } = await supabase
                  .from('users')
                  .select('id, name, avatar_url')
                  .eq('id', payload.new.user_id)
                  .maybeSingle();

                const message = {
                  id: payload.new.id,
                  chat_id: payload.new.chat_id,
                  content: payload.new.content,
                  created_at: payload.new.created_at,
                  sender_user_id: payload.new.user_id,
                  read_at: payload.new.read_at ?? null,
                  sender: userData || {
                    id: payload.new.user_id,
                    name: 'Unknown',
                    avatar_url: undefined,
                  },
                };

                callback(message);
              } catch (error) {
                console.error('[ServiceChat Subscribe] Error processing message:', error);
                if (onError) onError(error as Error);
              }
            }
          )
          .subscribe((status) => {
            const statusStr = String(status);
            if (statusStr === 'SUBSCRIPTION_ERROR' || statusStr === 'TIMED_OUT' || statusStr === 'CLOSED') {
              console.warn(`[ServiceChat Subscribe] Subscription failed with status: ${statusStr}`);
              if (onError) onError(new Error(`WebSocket subscription failed: ${statusStr}`));
            }
          });
      }).catch((error) => {
        console.error('[ServiceChat Subscribe] Error getting chat:', error);
        if (onError) onError(error as Error);
      });

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.warn('[ServiceChat Subscribe] Error removing channel:', error);
        }
      };
    },

    // Mark messages as read
    markAsRead: async (serviceId: string, churchId: string, userId: string) => {
      // Verify service belongs to church
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();

      if (!service || service.church_id !== churchId) return;

      // Get chat ID
      const { data: chat } = await supabase
        .from('service_chats')
        .select('id')
        .eq('service_id', serviceId)
        .single();

      if (!chat) return;

      // Mark unread messages from other users as read (schema uses user_id)
      const { error: updateError } = await supabase
        .from('service_chat_messages')
        .update({ read_at: new Date().toISOString() })
        .eq('chat_id', chat.id)
        .neq('user_id', userId)
        .is('read_at', null);

      if (updateError) {
        console.error('[ServiceChat] MarkAsRead update failed:', updateError);
      }
    },
  },

  // Assignments - Update to support confirm/decline
  assignments: {
    getByService: async (serviceId: string, churchId: string) => {
      // Verify: service belongs to church
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();
      
      if (!service || service.church_id !== churchId) {
        return [];
      }
      
      const { data } = await supabase
        .from('service_assignments')
        .select('*, team_members(*)')
        .eq('service_id', serviceId);
      return (data || []).map((a: any) => ({
        ...a,
        team_member: a.team_members || undefined,
      })) as ServiceAssignmentPopulated[];
    },
    getByTeamMember: async (teamMemberId: string, churchId: string) => {
      // Verify: team member belongs to church
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
    getById: async (id: string, churchId: string) => {
      const { data } = await supabase
        .from('service_assignments')
        .select('*, service_id, services(church_id)')
        .eq('id', id)
        .single();
      
      // Verify: service belongs to this church
      if (!data || !data.services || data.services.church_id !== churchId) {
        return null;
      }
      
      return data as ServiceAssignment;
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
      
      // Verify: service belongs to this church
      if (!data || !data.services || data.services.church_id !== churchId) {
        return null;
      }
      
      return data as ServiceAssignment;
    },
    confirm: async (id: string, churchId: string) => {
      return db.assignments.update(id, churchId, {
        status: 'confirmed',
        confirmed_at: new Date().toISOString(),
      });
    },
    decline: async (id: string, churchId: string) => {
      return db.assignments.update(id, churchId, {
        status: 'declined',
        declined_at: new Date().toISOString(),
      });
    },
    delete: async (id: string, churchId: string) => {
      // Verify: assignment's service belongs to this church
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
      // Verify: service belongs to this church
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
    bulkCreate: async (
      assignments: Array<{ service_id: string; team_member_id: string; role: string }>,
      churchId: string
    ) => {
      if (!assignments.length) return [];
      // Verify all services belong to the church
      const serviceIds = [...new Set(assignments.map((a) => a.service_id))];
      const { data: services } = await supabase
        .from('services')
        .select('id')
        .in('id', serviceIds)
        .eq('church_id', churchId);
      const validServiceIds = new Set((services || []).map((s) => s.id));
      const valid = assignments.filter((a) => validServiceIds.has(a.service_id));
      if (!valid.length) return [];
      const rows = valid.map((a) => ({
        service_id: a.service_id,
        team_member_id: a.team_member_id,
        role: sanitizeString(a.role),
        status: 'pending',
      }));
      const { data, error } = await supabase
        .from('service_assignments')
        .insert(rows)
        .select();
      if (error) {
        console.error('[Assignments] BulkCreate failed', error);
        return [];
      }
      return (data || []) as any[];
    },
  },

  // ─── Tasks & Checklists ────────────────────────────────────────────
  tasks: {
    getByService: async (serviceId: string, churchId: string) => {
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();
      if (!service || service.church_id !== churchId) return [];

      const { data } = await supabase
        .from('service_tasks')
        .select('*')
        .eq('service_id', serviceId)
        .order('position', { ascending: true });
      return (data || []) as ServiceTask[];
    },
    getByChurch: async (churchId: string) => {
      const { data } = await supabase
        .from('service_tasks')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });
      return (data || []) as ServiceTask[];
    },
    getMyTasks: async (churchId: string, teamMemberId: string) => {
      const { data } = await supabase
        .from('service_tasks')
        .select('*, services!inner(date, title)')
        .eq('church_id', churchId)
        .eq('assigned_team_member_id', teamMemberId)
        .neq('status', 'done')
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
    getById: async (id: string, churchId: string) => {
      const { data } = await supabase
        .from('service_tasks')
        .select('*')
        .eq('id', id)
        .eq('church_id', churchId)
        .single();
      return data as ServiceTask | null;
    },
    create: async (t: Omit<ServiceTask, 'id' | 'created_at'>) => {
      const payload = {
        ...t,
        title: sanitizeString(t.title),
        notes: t.notes ? sanitizeHtml(t.notes) : '',
      };
      const { data } = await supabase.from('service_tasks').insert(payload).select().single();
      return data as ServiceTask;
    },
    update: async (id: string, churchId: string, updates: Partial<ServiceTask>) => {
      const sanitized: Partial<ServiceTask> = { ...updates };
      if (sanitized.title) sanitized.title = sanitizeString(sanitized.title);
      if (sanitized.notes) sanitized.notes = sanitizeHtml(sanitized.notes);
      const { data } = await supabase
        .from('service_tasks')
        .update(sanitized)
        .eq('id', id)
        .eq('church_id', churchId)
        .select()
        .single();
      return data as ServiceTask;
    },
    toggleDone: async (id: string, churchId: string, userId: string) => {
      const task = await db.tasks.getById(id, churchId);
      if (!task) return null;
      const isDone = task.status === 'done';
      return db.tasks.update(id, churchId, {
        status: isDone ? 'pending' : 'done',
        completed_at: isDone ? null : new Date().toISOString(),
        completed_by: isDone ? null : userId,
      });
    },
    delete: async (id: string, churchId: string) => {
      const { error } = await supabase
        .from('service_tasks')
        .delete()
        .eq('id', id)
        .eq('church_id', churchId);
      return !error;
    },
    reorder: async (serviceId: string, orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, index) =>
          supabase.from('service_tasks').update({ position: index }).eq('id', id)
        )
      );
    },
    getTaskStats: async (serviceId: string, churchId: string) => {
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();
      if (!service || service.church_id !== churchId) {
        return { total: 0, done: 0 };
      }
      const { data } = await supabase
        .from('service_tasks')
        .select('status')
        .eq('service_id', serviceId);
      const tasks = data || [];
      return {
        total: tasks.length,
        done: tasks.filter((t) => t.status === 'done').length,
      };
    },
    generateFromTemplate: async (serviceId: string, churchId: string, templateId: string) => {
      const template = await db.taskTemplates.getById(templateId, churchId);
      if (!template || !template.items?.length) return [];

      const tasks = template.items.map((item, index) => ({
        service_id: serviceId,
        church_id: churchId,
        template_id: templateId,
        title: item.title,
        notes: '',
        assigned_team_member_id: null,
        assigned_role: template.role_scope,
        position: index,
        status: 'pending' as const,
        completed_at: null,
        completed_by: null,
        due_offset_minutes: null,
      }));

      const { data } = await supabase.from('service_tasks').insert(tasks).select();
      return (data || []) as ServiceTask[];
    },
  },

  // Task Templates
  taskTemplates: {
    getByChurch: async (churchId: string) => {
      const { data } = await supabase
        .from('task_templates')
        .select('*, task_template_items(*)')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
    getById: async (id: string, churchId: string) => {
      const { data } = await supabase
        .from('task_templates')
        .select('*, task_template_items(*)')
        .eq('id', id)
        .eq('church_id', churchId)
        .single();
      if (!data) return null;
      return {
        ...data,
        items: (data.task_template_items || []).sort((a: TaskTemplateItem, b: TaskTemplateItem) => a.position - b.position),
      } as TaskTemplate & { items: TaskTemplateItem[] };
    },
    create: async (t: Omit<TaskTemplate, 'id' | 'created_at' | 'updated_at'>) => {
      const payload = {
        ...t,
        name: sanitizeString(t.name),
        description: t.description ? sanitizeString(t.description) : '',
      };
      const { data } = await supabase.from('task_templates').insert(payload).select().single();
      return data as TaskTemplate;
    },
    update: async (id: string, churchId: string, updates: Partial<TaskTemplate>) => {
      const sanitized: Partial<TaskTemplate> = { ...updates };
      if (sanitized.name) sanitized.name = sanitizeString(sanitized.name);
      if (sanitized.description) sanitized.description = sanitizeString(sanitized.description);
      const { data } = await supabase
        .from('task_templates')
        .update({ ...sanitized, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('church_id', churchId)
        .select()
        .single();
      return data as TaskTemplate;
    },
    delete: async (id: string, churchId: string) => {
      const { error } = await supabase
        .from('task_templates')
        .delete()
        .eq('id', id)
        .eq('church_id', churchId);
      return !error;
    },
    // Template Items
    addItem: async (templateId: string, item: Omit<TaskTemplateItem, 'id'>) => {
      const { data } = await supabase
        .from('task_template_items')
        .insert({ ...item, title: sanitizeString(item.title) })
        .select()
        .single();
      return data as TaskTemplateItem;
    },
    updateItem: async (itemId: string, updates: Partial<TaskTemplateItem>) => {
      const sanitized: Partial<TaskTemplateItem> = { ...updates };
      if (sanitized.title) sanitized.title = sanitizeString(sanitized.title);
      const { data } = await supabase
        .from('task_template_items')
        .update(sanitized)
        .eq('id', itemId)
        .select()
        .single();
      return data as TaskTemplateItem;
    },
    deleteItem: async (itemId: string) => {
      const { error } = await supabase.from('task_template_items').delete().eq('id', itemId);
      return !error;
    },
  },

  // Task Dependencies
  taskDependencies: {
    getByTask: async (taskId: string, churchId: string) => {
      const { data: task } = await supabase
        .from('service_tasks')
        .select('church_id')
        .eq('id', taskId)
        .single();
      if (!task || task.church_id !== churchId) return [];

      const { data } = await supabase
        .from('task_dependencies')
        .select('*')
        .eq('task_id', taskId);
      return (data || []) as any[];
    },
    create: async (dep: { task_id: string; depends_on_task_id: string; dependency_type?: string; church_id: string }) => {
      const { data } = await supabase
        .from('task_dependencies')
        .insert({
          task_id: dep.task_id,
          depends_on_task_id: dep.depends_on_task_id,
          dependency_type: dep.dependency_type || 'finish_to_start',
          church_id: dep.church_id,
        })
        .select()
        .single();
      return data;
    },
    delete: async (taskId: string, dependsOnId: string, churchId: string) => {
      const { error } = await supabase
        .from('task_dependencies')
        .delete()
        .eq('task_id', taskId)
        .eq('depends_on_task_id', dependsOnId)
        .eq('church_id', churchId);
      return !error;
    },
    canComplete: async (taskId: string, churchId: string) => {
      const { data, error } = await supabase.rpc('can_complete_task', { task_uuid: taskId });
      if (error) {
        console.error('[TaskDependencies] canComplete failed:', error);
        return true; // Default to true if check fails
      }
      return data as boolean;
    },
  },

  // ─── Member Groups / Bands ─────────────────────────────────────────
  memberGroups: {
    getByChurch: async (churchId: string) => {
      const { data } = await supabase
        .from('member_groups')
        .select('*, member_group_members(team_member_id, role)')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
    getById: async (id: string, churchId: string) => {
      const { data } = await supabase
        .from('member_groups')
        .select('*, member_group_members(team_member_id, role)')
        .eq('id', id)
        .eq('church_id', churchId)
        .single();
      return data as any | null;
    },
    create: async (g: { church_id: string; name: string; description?: string }) => {
      const payload = {
        church_id: g.church_id,
        name: sanitizeString(g.name),
        description: g.description ? sanitizeString(g.description) : '',
      };
      const { data } = await supabase.from('member_groups').insert(payload).select().single();
      return data as any;
    },
    update: async (id: string, churchId: string, updates: { name?: string; description?: string }) => {
      const sanitized: any = { ...updates };
      if (sanitized.name) sanitized.name = sanitizeString(sanitized.name);
      if (sanitized.description) sanitized.description = sanitizeString(sanitized.description);
      const { data } = await supabase
        .from('member_groups')
        .update(sanitized)
        .eq('id', id)
        .eq('church_id', churchId)
        .select()
        .single();
      return data as any;
    },
    delete: async (id: string, churchId: string) => {
      const { error } = await supabase
        .from('member_groups')
        .delete()
        .eq('id', id)
        .eq('church_id', churchId);
      return !error;
    },
    addMember: async (groupId: string, teamMemberId: string, role?: string) => {
      const { data } = await supabase
        .from('member_group_members')
        .insert({ group_id: groupId, team_member_id: teamMemberId, role: role || null })
        .select()
        .single();
      return data;
    },
    removeMember: async (groupId: string, teamMemberId: string) => {
      const { error } = await supabase
        .from('member_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('team_member_id', teamMemberId);
      return !error;
    },
    getMembers: async (groupId: string) => {
      const { data } = await supabase
        .from('member_group_members')
        .select('team_member_id, role')
        .eq('group_id', groupId);
      return (data || []) as any[];
    },
  },

  // ─── Team Member Private Notes ─────────────────────────────────────
  memberNotes: {
    getByMember: async (teamMemberId: string) => {
      const { data } = await supabase
        .from('team_member_notes')
        .select('*')
        .eq('team_member_id', teamMemberId)
        .order('created_at', { ascending: false });
      return (data || []) as any[];
    },
    create: async (n: { team_member_id: string; author_user_id: string; note: string }) => {
      const payload = { ...n, note: sanitizeString(n.note) };
      const { data } = await supabase.from('team_member_notes').insert(payload).select().single();
      return data as any;
    },
    delete: async (id: string) => {
      const { error } = await supabase.from('team_member_notes').delete().eq('id', id);
      return !error;
    },
  },

  // ─── Chat Channels ─────────────────────────────────────────────────
  channels: {
    getByChurch: async (churchId: string) => {
      const { data } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: true });
      return (data || []) as any[];
    },
    getById: async (id: string, churchId: string) => {
      const { data } = await supabase
        .from('chat_channels')
        .select('*')
        .eq('id', id)
        .eq('church_id', churchId)
        .single();
      return data as any | null;
    },
    create: async (c: { church_id: string; name: string; type?: string; role_scope?: string }) => {
      const payload = {
        church_id: c.church_id,
        name: sanitizeString(c.name),
        type: c.type || 'channel',
        role_scope: c.role_scope || null,
      };
      const { data } = await supabase.from('chat_channels').insert(payload).select().single();
      return data as any;
    },
    delete: async (id: string, churchId: string) => {
      const { error } = await supabase
        .from('chat_channels')
        .delete()
        .eq('id', id)
        .eq('church_id', churchId);
      return !error;
    },
    getMembers: async (channelId: string) => {
      const { data } = await supabase
        .from('chat_channel_members')
        .select('user_id, joined_at')
        .eq('channel_id', channelId);
      return (data || []) as any[];
    },
    addMember: async (channelId: string, userId: string) => {
      const { data } = await supabase
        .from('chat_channel_members')
        .insert({ channel_id: channelId, user_id: userId })
        .select()
        .single();
      return data;
    },
    getMessages: async (channelId: string) => {
      const { data } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('channel_id', channelId)
        .order('created_at', { ascending: true });
      return (data || []) as any[];
    },
  },

  // ─── Rehearsal Tracking ─────────────────────────────────────────────
  rehearsals: {
    getByService: async (serviceId: string, churchId: string) => {
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();
      if (!service || service.church_id !== churchId) return [];

      const { data } = await supabase
        .from('rehearsal_logs')
        .select('*, team_members(name)')
        .eq('service_id', serviceId);
      return (data || []) as any[];
    },

    getByTeamMember: async (serviceId: string, teamMemberId: string, churchId: string) => {
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();
      if (!service || service.church_id !== churchId) return [];

      const { data } = await supabase
        .from('rehearsal_logs')
        .select('*')
        .eq('service_id', serviceId)
        .eq('team_member_id', teamMemberId);
      return (data || []) as RehearsalLog[];
    },

    upsert: async (
      serviceId: string,
      teamMemberId: string,
      songId: string,
      rehearsed: boolean,
      churchId: string
    ) => {
      // Verify the team member is assigned to this service
      const { data: assignment } = await supabase
        .from('service_assignments')
        .select('id')
        .eq('service_id', serviceId)
        .eq('team_member_id', teamMemberId)
        .maybeSingle();
      if (!assignment) {
        console.error('[Rehearsals] Upsert failed: team member not assigned to this service');
        throw new Error('Not assigned to this service');
      }

      const payload = {
        church_id: churchId,
        service_id: serviceId,
        team_member_id: teamMemberId,
        song_id: songId,
        rehearsed,
        rehearsed_at: rehearsed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('rehearsal_logs')
        .upsert(payload, { onConflict: 'service_id,team_member_id,song_id' })
        .select()
        .single();

      if (error) {
        console.error('[Rehearsals] Upsert failed:', error);
        throw error;
      }
      return data as RehearsalLog;
    },

    markAll: async (serviceId: string, teamMemberId: string, churchId: string) => {
      const items = await db.serviceItems.getByService(serviceId);
      const songItems = items.filter(i => i.type === 'song' && i.song_id);

      await Promise.all(
        songItems.map(item =>
          db.rehearsals.upsert(serviceId, teamMemberId, item.song_id!, true, churchId)
        )
      );
    },

    getStatsByService: async (serviceId: string, churchId: string) => {
      const items = await db.serviceItems.getByService(serviceId);
      const totalSongs = items.filter(i => i.type === 'song' && i.song_id).length;

      const assignments = await db.assignments.getByService(serviceId, churchId);
      if (assignments.length === 0 || totalSongs === 0) return [];

      const memberIds = assignments.map(a => a.team_member_id);

      const { data: logs } = await supabase
        .from('rehearsal_logs')
        .select('team_member_id, song_id')
        .eq('service_id', serviceId)
        .eq('rehearsed', true)
        .in('team_member_id', memberIds);

      const rehearsalCounts: Record<string, Set<string>> = {};
      for (const log of logs || []) {
        if (!rehearsalCounts[log.team_member_id]) {
          rehearsalCounts[log.team_member_id] = new Set();
        }
        rehearsalCounts[log.team_member_id].add(log.song_id);
      }

      return assignments.map(a => ({
        team_member_id: a.team_member_id,
        member_name: a.team_member?.name || 'Unknown',
        member_role: a.role,
        rehearsed_count: rehearsalCounts[a.team_member_id]?.size || 0,
        total_songs: totalSongs,
      })) as RehearsalStats[];
    },
  },

  // ─── Service Debriefs ─────────────────────────────────────────────
  debriefs: {
    getByService: async (serviceId: string, churchId: string) => {
      const { data: service } = await supabase
        .from('services')
        .select('church_id')
        .eq('id', serviceId)
        .single();
      if (!service || service.church_id !== churchId) return [];

      const { data } = await supabase
        .from('service_debriefs')
        .select('*, users(id, name, avatar_url, email)')
        .eq('service_id', serviceId)
        .order('created_at', { ascending: false });
      return (data || []).map((d: any) => ({
        ...d,
        user: d.users ? {
          id: d.users.id,
          name: d.users.name,
          avatar_url: d.users.avatar_url,
          email: d.users.email,
        } : { id: d.user_id, name: 'Unknown' },
        timing_data: typeof d.timing_data === 'string' ? JSON.parse(d.timing_data) : (d.timing_data || []),
      })) as ServiceDebriefPopulated[];
    },

    getByChurch: async (churchId: string, options?: { limit?: number; months?: number }) => {
      let query = supabase
        .from('service_debriefs')
        .select('*, services(title, date), users(id, name, avatar_url)')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

      if (options?.months) {
        const since = new Date();
        since.setMonth(since.getMonth() - options.months);
        query = query.gte('created_at', since.toISOString());
      }

      const limit = options?.limit || 100;
      query = query.limit(limit);

      const { data } = await query;
      return (data || []).map((d: any) => ({
        ...d,
        user: d.users ? { id: d.users.id, name: d.users.name, avatar_url: d.users.avatar_url } : { id: d.user_id, name: 'Unknown' },
        service: d.services ? { title: d.services.title, date: d.services.date } : undefined,
        timing_data: typeof d.timing_data === 'string' ? JSON.parse(d.timing_data) : (d.timing_data || []),
      })) as (ServiceDebriefPopulated & { service?: { title: string; date: string } })[];
    },

    getByUser: async (churchId: string, userId: string) => {
      const { data } = await supabase
        .from('service_debriefs')
        .select('*, services(title, date), users(id, name, avatar_url)')
        .eq('church_id', churchId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      return (data || []).map((d: any) => ({
        ...d,
        user: d.users ? { id: d.users.id, name: d.users.name, avatar_url: d.users.avatar_url } : { id: d.user_id, name: 'Unknown' },
        service: d.services ? { title: d.services.title, date: d.services.date } : undefined,
        timing_data: typeof d.timing_data === 'string' ? JSON.parse(d.timing_data) : (d.timing_data || []),
      })) as (ServiceDebriefPopulated & { service?: { title: string; date: string } })[];
    },

    getById: async (id: string, churchId: string) => {
      const { data } = await supabase
        .from('service_debriefs')
        .select('*, users(id, name, avatar_url)')
        .eq('id', id)
        .eq('church_id', churchId)
        .single();
      if (!data) return null;
      return {
        ...data,
        user: data.users ? { id: data.users.id, name: data.users.name, avatar_url: data.users.avatar_url } : { id: data.user_id, name: 'Unknown' },
        timing_data: typeof data.timing_data === 'string' ? JSON.parse(data.timing_data) : (data.timing_data || []),
      } as ServiceDebriefPopulated;
    },

    upsert: async (d: {
      service_id: string;
      user_id: string;
      church_id: string;
      rating_engagement: number;
      rating_flow: number;
      rating_tech: number;
      what_went_well: string;
      what_broke: string;
      what_to_change: string;
      saw_god_working: string;
      timing_data?: TimingComparisonItem[];
    }) => {
      const sanitized = sanitizeInput.debrief(d);
      const payload = {
        ...sanitized,
        timing_data: sanitized.timing_data || [],
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('service_debriefs')
        .upsert(payload, { onConflict: 'service_id,user_id' })
        .select()
        .single();

      if (error) {
        console.error('[Debriefs] Upsert failed:', error);
        throw error;
      }
      return data as ServiceDebrief;
    },

    delete: async (id: string, churchId: string) => {
      const { error } = await supabase
        .from('service_debriefs')
        .delete()
        .eq('id', id)
        .eq('church_id', churchId);
      return !error;
    },

    getTrends: async (churchId: string, months = 6) => {
      const since = new Date();
      since.setMonth(since.getMonth() - months);

      const { data } = await supabase
        .from('service_debriefs')
        .select('rating_engagement, rating_flow, rating_tech, created_at')
        .eq('church_id', churchId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });

      if (!data || data.length === 0) return [];

      const monthly: Record<string, { engagement: number[]; flow: number[]; tech: number[] }> = {};
      for (const d of data) {
        const period = (d.created_at as string).substring(0, 7); // "YYYY-MM"
        if (!monthly[period]) monthly[period] = { engagement: [], flow: [], tech: [] };
        monthly[period].engagement.push(d.rating_engagement);
        monthly[period].flow.push(d.rating_flow);
        monthly[period].tech.push(d.rating_tech);
      }

      return Object.entries(monthly).map(([period, ratings]) => ({
        period,
        avg_engagement: Math.round((ratings.engagement.reduce((a, b) => a + b, 0) / ratings.engagement.length) * 10) / 10,
        avg_flow: Math.round((ratings.flow.reduce((a, b) => a + b, 0) / ratings.flow.length) * 10) / 10,
        avg_tech: Math.round((ratings.tech.reduce((a, b) => a + b, 0) / ratings.tech.length) * 10) / 10,
        total_debriefs: ratings.engagement.length,
      })) as DebriefTrends[];
    },
  },
};
