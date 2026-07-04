'use client';

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
  RehearsalLog,
  RehearsalStats,
  ServiceDebrief,
  TimingComparisonItem,
  DebriefTrends,
  ServiceTask,
  MemberGroup,
  MemberGroupMember,
  TeamMemberNote,
} from '@/lib/types';

// Get the demo context type from the context file
type DemoContextType = {
  user: User | null;
  church: Church | null;
  songs: Song[];
  teamMembers: TeamMember[];
  services: Service[];
  serviceItems: ServiceItem[];
  assignments: ServiceAssignment[];
  songUsage: SongUsage[];
  templates: ServiceTemplate[];
  rehearsalLogs: RehearsalLog[];
  tasks: ServiceTask[];
  memberGroups: MemberGroup[];
  memberGroupMembers: MemberGroupMember[];
  memberNotes: TeamMemberNote[];
  chatChannels: any[];
  chatMessages: any[];
  debriefs: ServiceDebrief[];
  createSong: (song: Omit<Song, 'id' | 'created_at'>) => Song;
  updateSong: (id: string, updates: Partial<Song>) => Song;
  deleteSong: (id: string) => boolean;
  createTeamMember: (tm: Omit<TeamMember, 'id' | 'created_at'>) => TeamMember;
  updateTeamMember: (id: string, updates: Partial<TeamMember>) => TeamMember;
  deleteTeamMember: (id: string) => boolean;
  createService: (s: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => Service;
  updateService: (id: string, updates: Partial<Service>) => Service;
  deleteService: (id: string) => boolean;
  duplicateService: (sourceId: string, newDate: string, newTitle?: string) => Service | null;
  createServiceItem: (si: Omit<ServiceItem, 'id'>) => ServiceItem;
  updateServiceItem: (id: string, updates: Partial<ServiceItem>) => ServiceItem;
  deleteServiceItem: (id: string) => boolean;
  reorderServiceItems: (serviceId: string, orderedIds: string[]) => void;
  createAssignment: (sa: Omit<ServiceAssignment, 'id'>) => ServiceAssignment;
  updateAssignment: (id: string, updates: Partial<ServiceAssignment>) => ServiceAssignment;
  deleteAssignment: (id: string) => boolean;
  deleteAssignmentsByService: (serviceId: string) => boolean;
  createSongUsage: (su: Omit<SongUsage, 'id'>) => SongUsage;
  createSongUsageForService: (serviceId: string, date: string) => void;
  createTemplate: (t: Omit<ServiceTemplate, 'id' | 'created_at'>) => ServiceTemplate;
  updateTemplate: (id: string, updates: Partial<ServiceTemplate>) => ServiceTemplate;
  deleteTemplate: (id: string) => boolean;
  createServiceFromTemplate: (templateId: string, dateString: string) => Service | null;
  createTask: (t: Omit<ServiceTask, 'id' | 'created_at'>) => ServiceTask;
  updateTask: (id: string, updates: Partial<ServiceTask>) => ServiceTask;
  deleteTask: (id: string) => boolean;
  toggleTask: (id: string, userId: string) => ServiceTask | null;
  reorderTasks: (serviceId: string, orderedIds: string[]) => void;
  createGroup: (g: Omit<MemberGroup, 'id' | 'created_at' | 'updated_at'>) => MemberGroup;
  updateGroup: (id: string, updates: Partial<MemberGroup>) => MemberGroup;
  deleteGroup: (id: string) => boolean;
  addGroupMember: (groupId: string, teamMemberId: string, role?: string) => MemberGroupMember;
  removeGroupMember: (groupId: string, teamMemberId: string) => boolean;
  createMemberNote: (n: Omit<TeamMemberNote, 'id' | 'created_at' | 'updated_at'>) => TeamMemberNote;
  deleteMemberNote: (id: string) => boolean;
  upsertDebrief: (d: Omit<ServiceDebrief, 'id' | 'created_at' | 'updated_at'>) => ServiceDebrief;
  getDebriefByService: (serviceId: string) => ServiceDebrief | undefined;
  markRehearsed: (serviceId: string, teamMemberId: string, songId: string, rehearsed: boolean) => RehearsalLog;
  markAllRehearsed: (serviceId: string, teamMemberId: string) => void;
  getRehearsalStats: (serviceId: string) => { team_member_id: string; member_name: string; member_role: string; rehearsed_count: number; total_songs: number }[];
};

// In-memory persistence for demo service chat messages (keyed by serviceId)
const demoServiceMessages: Record<string, any[]> = {};

function createDemoServiceChat(getDemoContext: () => DemoContextType) {
  const ensureSeeded = async (serviceId: string) => {
    const chatId = `demo-chat-${serviceId}`;
    if (!demoServiceMessages[serviceId]) {
      const demo = getDemoContext();
      const seed: any[] = [];
      if (demo.user) {
        seed.push({
          id: `seed-${serviceId}-1`,
          chat_id: chatId,
          content: "Don't forget rehearsal Thursday at 7pm! 🎸",
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
          sender_user_id: 'demo-teammate',
          read_at: null,
          sender: { id: 'demo-teammate', name: 'Sarah Johnson', avatar_url: undefined },
        });
        seed.push({
          id: `seed-${serviceId}-2`,
          chat_id: chatId,
          content: "Sounds great! I'll have the chord charts ready.",
          created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
          sender_user_id: demo.user.id,
          read_at: new Date().toISOString(),
          sender: { id: demo.user.id, name: demo.user.name, avatar_url: demo.user.avatar_url },
        });
      }
      demoServiceMessages[serviceId] = seed;
    }
    return chatId;
  };

  return {
    getOrCreate: async (serviceId: string, churchId: string): Promise<any> => {
      const chatId = await ensureSeeded(serviceId);
      return { id: chatId, service_id: serviceId, church_id: churchId, created_at: new Date().toISOString() };
    },
    getMessages: async (serviceId: string, _churchId: string): Promise<any[]> => {
      await ensureSeeded(serviceId);
      return [...demoServiceMessages[serviceId]];
    },
    createMessage: async (
      serviceId: string,
      _churchId: string,
      senderUserId: string,
      content: string,
    ): Promise<any> => {
      await ensureSeeded(serviceId);
      const demo = getDemoContext();
      const message = {
        id: `demo-msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        chat_id: `demo-chat-${serviceId}`,
        content,
        created_at: new Date().toISOString(),
        sender_user_id: senderUserId,
        read_at: null,
        sender: {
          id: demo.user?.id || senderUserId,
          name: demo.user?.name || 'Unknown',
          avatar_url: demo.user?.avatar_url,
        },
      };
      demoServiceMessages[serviceId].push(message);
      return message;
    },
    subscribe: (_serviceId: string, _churchId: string, _callback: (message: any) => void) => {
      return () => {};
    },
    markAsRead: async (serviceId: string, _churchId: string, userId: string): Promise<void> => {
      const msgs = demoServiceMessages[serviceId];
      if (msgs) {
        msgs.forEach((m) => {
          if (m.sender_user_id !== userId && !m.read_at) {
            m.read_at = new Date().toISOString();
          }
        });
      }
    },
  };
}

// This creates a demo store object that mirrors the real db interface
export function createDemoStore(getDemoContext: () => DemoContextType) {
  return {
    churches: {
      getById: async (id: string): Promise<Church | null> => {
        const demo = getDemoContext();
        return demo.church?.id === id ? demo.church : null;
      },
      create: async (_c: Omit<Church, 'id' | 'created_at'>): Promise<Church> => {
        throw new Error('Not implemented in demo');
      },
    },
    
    users: {
      getByEmail: async (email: string): Promise<User | null> => {
        const demo = getDemoContext();
        return demo.user?.email?.toLowerCase() === email.toLowerCase() ? demo.user : null;
      },
      getByChurch: async (churchId: string): Promise<User[]> => {
        const demo = getDemoContext();
        if (demo.user?.church_id === churchId) {
          return [demo.user];
        }
        return [];
      },
    },
    
    services: {
      getByChurch: async (churchId: string): Promise<Service[]> => {
        const demo = getDemoContext();
        return demo.services
          .filter(s => s.church_id === churchId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      },
      getById: async (id: string, _churchId?: string): Promise<Service | null> => {
        const demo = getDemoContext();
        return demo.services.find(s => s.id === id) || null;
      },
      create: async (s: Omit<Service, 'id' | 'created_at' | 'updated_at'>): Promise<Service> => {
        const demo = getDemoContext();
        return demo.createService(s);
      },
      update: async (id: string, _churchId: string, updates: Partial<Service>): Promise<Service> => {
        const demo = getDemoContext();
        return demo.updateService(id, updates);
      },
      delete: async (id: string): Promise<boolean> => {
        const demo = getDemoContext();
        return demo.deleteService(id);
      },
      duplicate: async (sourceId: string, newDate: string, newTitle?: string): Promise<Service | null> => {
        const demo = getDemoContext();
        return demo.duplicateService(sourceId, newDate, newTitle);
      },
    },
    
    serviceItems: {
      getByService: async (serviceId: string): Promise<ServiceItem[]> => {
        const demo = getDemoContext();
        return demo.serviceItems
          .filter(si => si.service_id === serviceId)
          .sort((a, b) => a.position - b.position);
      },
      getById: async (id: string, _churchId: string): Promise<ServiceItem | null> => {
        const demo = getDemoContext();
        return demo.serviceItems.find(si => si.id === id) || null;
      },
      create: async (si: Omit<ServiceItem, 'id'>): Promise<ServiceItem> => {
        const demo = getDemoContext();
        return demo.createServiceItem(si);
      },
      update: async (id: string, _churchId: string, updates: Partial<ServiceItem>): Promise<ServiceItem> => {
        const demo = getDemoContext();
        return demo.updateServiceItem(id, updates);
      },
      delete: async (id: string, _churchId: string): Promise<boolean> => {
        const demo = getDemoContext();
        return demo.deleteServiceItem(id);
      },
      reorder: async (serviceId: string, _churchId: string, orderedIds: string[]): Promise<void> => {
        const demo = getDemoContext();
        demo.reorderServiceItems(serviceId, orderedIds);
      },
    },
    
    songs: {
      getByChurch: async (churchId: string): Promise<Song[]> => {
        const demo = getDemoContext();
        return demo.songs.filter(s => s.church_id === churchId).sort((a, b) => a.title.localeCompare(b.title));
      },
      getById: async (id: string, _churchId?: string): Promise<Song | null> => {
        const demo = getDemoContext();
        return demo.songs.find(s => s.id === id) || null;
      },
      create: async (s: Omit<Song, 'id' | 'created_at'>): Promise<Song> => {
        const demo = getDemoContext();
        return demo.createSong(s);
      },
      update: async (id: string, _churchId: string, updates: Partial<Song>): Promise<Song> => {
        const demo = getDemoContext();
        return demo.updateSong(id, updates);
      },
      delete: async (id: string): Promise<boolean> => {
        const demo = getDemoContext();
        return demo.deleteSong(id);
      },
    },
    
    songFiles: {
      getBySong: async (_songId: string, _churchId?: string): Promise<SongFile[]> => {
        // Demo doesn't support file uploads
        return [];
      },
      create: async (_sf: Omit<SongFile, 'id' | 'created_at'>): Promise<SongFile> => {
        throw new Error('File uploads not supported in demo');
      },
      update: async (_id: string, _churchId: string, _updates: Partial<SongFile>): Promise<SongFile> => {
        throw new Error('File uploads not supported in demo');
      },
      delete: async (_id: string, _churchId?: string): Promise<boolean> => {
        throw new Error('File uploads not supported in demo');
      },
      setPrimary: async (_id: string, _songId: string, _churchId: string): Promise<SongFile> => {
        throw new Error('File uploads not supported in demo');
      },
    },

    songVersions: {
      getBySong: async (_songId: string, _churchId: string): Promise<any[]> => [],
      getById: async (_id: string, _churchId: string): Promise<any> => null,
      create: async (_sv: any): Promise<any> => {
        throw new Error('Not supported in demo');
      },
      restore: async (_songId: string, _versionNumber: number, _churchId: string): Promise<any> => null,
      delete: async (_id: string, _churchId: string): Promise<boolean> => false,
    },

    songArrangements: {
      getBySong: async (_songId: string, _churchId: string): Promise<any[]> => [],
      getById: async (_id: string, _churchId: string): Promise<any> => null,
      create: async (_sa: any): Promise<any> => {
        throw new Error('Not supported in demo');
      },
      update: async (_id: string, _churchId: string, _updates: any): Promise<any> => {
        throw new Error('Not supported in demo');
      },
      delete: async (_id: string, _churchId: string): Promise<boolean> => false,
      setDefault: async (_id: string, _songId: string, _churchId: string): Promise<any> => {
        throw new Error('Not supported in demo');
      },
    },

    songHistory: {
      getBySong: async (_songId: string, _churchId: string): Promise<any[]> => [],
      getByChurch: async (_churchId: string): Promise<any[]> => [],
    },

    songSearch: {
      search: async (churchId: string, query: string, _filters?: any): Promise<Song[]> => {
        const demo = getDemoContext();
        const songs = demo.songs.filter(s => s.church_id === churchId);
        if (!query.trim()) return songs;
        const q = query.toLowerCase();
        return songs.filter(s =>
          s.title.toLowerCase().includes(q) ||
          (s.artist && s.artist.toLowerCase().includes(q))
        );
      },
    },
    
    teamMembers: {
      getByChurch: async (churchId: string): Promise<TeamMember[]> => {
        const demo = getDemoContext();
        return demo.teamMembers.filter(tm => tm.church_id === churchId).sort((a, b) => a.name.localeCompare(b.name));
      },
      getById: async (id: string, _churchId?: string): Promise<TeamMember | null> => {
        const demo = getDemoContext();
        return demo.teamMembers.find(tm => tm.id === id) || null;
      },
      create: async (tm: Omit<TeamMember, 'id' | 'created_at'>): Promise<TeamMember> => {
        const demo = getDemoContext();
        return demo.createTeamMember(tm);
      },
      update: async (id: string, _churchId: string, updates: Partial<TeamMember>): Promise<TeamMember> => {
        const demo = getDemoContext();
        return demo.updateTeamMember(id, updates);
      },
      delete: async (id: string): Promise<boolean> => {
        const demo = getDemoContext();
        return demo.deleteTeamMember(id);
      },
      bulkCreate: async (members: Omit<TeamMember, 'id' | 'created_at'>[]): Promise<TeamMember[]> => {
        const demo = getDemoContext();
        return members.map(m => demo.createTeamMember(m));
      },
      bulkUpdate: async (updates: Array<{ id: string; data: Partial<TeamMember> }>): Promise<TeamMember[]> => {
        const demo = getDemoContext();
        return updates.map(u => demo.updateTeamMember(u.id, u.data));
      },
      bulkDelete: async (ids: string[], _churchId: string): Promise<number> => {
        const demo = getDemoContext();
        let count = 0;
        for (const id of ids) {
          if (demo.deleteTeamMember(id)) count++;
        }
        return count;
      },
      bulkAssignRole: async (ids: string[], _churchId: string, role: string): Promise<TeamMember[]> => {
        const demo = getDemoContext();
        return ids.map(id => demo.updateTeamMember(id, { roles: [role] }));
      },
    },

    assignments: {
      getByService: async (serviceId: string, _churchId: string): Promise<ServiceAssignment[]> => {
        const demo = getDemoContext();
        return demo.assignments.filter(a => a.service_id === serviceId);
      },
      getByTeamMember: async (teamMemberId: string, _churchId: string): Promise<ServiceAssignment[]> => {
        const demo = getDemoContext();
        return demo.assignments.filter(a => a.team_member_id === teamMemberId);
      },
      getById: async (_id: string, _churchId: string): Promise<ServiceAssignment | null> => {
        const demo = getDemoContext();
        return demo.assignments.find(a => a.id === _id) || null;
      },
      create: async (sa: Omit<ServiceAssignment, 'id'>): Promise<ServiceAssignment> => {
        const demo = getDemoContext();
        return demo.createAssignment(sa);
      },
      update: async (id: string, _churchId: string, updates: Partial<ServiceAssignment>): Promise<ServiceAssignment | null> => {
        const demo = getDemoContext();
        return demo.updateAssignment(id, updates);
      },
      confirm: async (id: string, _churchId: string): Promise<ServiceAssignment | null> => {
        const demo = getDemoContext();
        return demo.updateAssignment(id, { status: 'confirmed', confirmed_at: new Date().toISOString() });
      },
      decline: async (id: string, _churchId: string): Promise<ServiceAssignment | null> => {
        const demo = getDemoContext();
        return demo.updateAssignment(id, { status: 'declined', declined_at: new Date().toISOString() });
      },
      delete: async (id: string, _churchId: string): Promise<boolean> => {
        const demo = getDemoContext();
        return demo.deleteAssignment(id);
      },
      deleteByService: async (serviceId: string, _churchId: string): Promise<boolean> => {
        const demo = getDemoContext();
        return demo.deleteAssignmentsByService(serviceId);
      },
      bulkCreate: async (
        assignments: Array<{ service_id: string; team_member_id: string; role: string }>
      ): Promise<ServiceAssignment[]> => {
        const demo = getDemoContext();
        return assignments.map(a => demo.createAssignment({ ...a, status: 'pending' }));
      },
    },
    
    songUsage: {
      getByChurch: async (churchId: string): Promise<SongUsage[]> => {
        const demo = getDemoContext();
        return demo.songUsage
          .filter(su => su.church_id === churchId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      },
      getBySong: async (songId: string): Promise<SongUsage[]> => {
        const demo = getDemoContext();
        return demo.songUsage
          .filter(su => su.song_id === songId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      },
      create: async (su: Omit<SongUsage, 'id'>): Promise<SongUsage> => {
        const demo = getDemoContext();
        return demo.createSongUsage(su);
      },
      createForService: async (serviceId: string, _churchId: string, date: string): Promise<void> => {
        const demo = getDemoContext();
        demo.createSongUsageForService(serviceId, date);
      },
    },
    
    templates: {
      getByChurch: async (churchId: string): Promise<ServiceTemplate[]> => {
        const demo = getDemoContext();
        return demo.templates
          .filter(t => t.church_id === churchId)
          .sort((a, b) => a.day_of_week - b.day_of_week);
      },
      getById: async (id: string, _churchId?: string): Promise<ServiceTemplate | null> => {
        const demo = getDemoContext();
        return demo.templates.find(t => t.id === id) || null;
      },
      create: async (t: Omit<ServiceTemplate, 'id' | 'created_at'>): Promise<ServiceTemplate> => {
        const demo = getDemoContext();
        return demo.createTemplate(t);
      },
      update: async (id: string, _churchId: string, updates: Partial<ServiceTemplate>): Promise<ServiceTemplate> => {
        const demo = getDemoContext();
        return demo.updateTemplate(id, updates);
      },
      delete: async (id: string): Promise<boolean> => {
        const demo = getDemoContext();
        return demo.deleteTemplate(id);
      },
      createServiceFromTemplate: async (templateId: string, dateString: string, _churchId: string): Promise<Service | null> => {
        const demo = getDemoContext();
        return demo.createServiceFromTemplate(templateId, dateString);
      },
    },
    
    notifications: {
      getByUser: async (_userId: string): Promise<Notification[]> => {
        // Demo doesn't have notifications
        return [];
      },
      getUnreadCount: async (_userId: string): Promise<number> => {
        return 0;
      },
      markRead: async (_id: string): Promise<void> => {
        // No-op in demo
      },
      markAllRead: async (_userId: string): Promise<void> => {
        // No-op in demo
      },
      create: async (_n: Omit<Notification, 'id' | 'created_at'>): Promise<Notification> => {
        throw new Error('Notifications not supported in demo');
      },
    },
    
    invites: {
      getByToken: async (_token: string): Promise<Invite | null> => {
        return null;
      },
      markUsed: async (_id: string): Promise<boolean> => {
        return false;
      },
      create: async (_invite: Omit<Invite, 'id' | 'used_at'>): Promise<Invite> => {
        throw new Error('Invites not supported in demo');
      },
      getByChurch: async (_churchId: string): Promise<Invite[]> => {
        return [];
      },
      getByEmail: async (_email: string): Promise<Invite | null> => {
        return null;
      },
    },
    
    mapChatMessage: (msg: any): ChatMessagePopulated => {
      // Demo messages are already in the right format
      return {
        id: msg.id,
        church_id: msg.church_id,
        user_id: msg.user_id || (msg.user?.id || 'unknown'),
        content: msg.content,
        created_at: msg.created_at,
        user: msg.user || { id: 'unknown', name: 'Unknown User' },
      };
    },

    chat: {
      getByChurch: async (_churchId: string, _limit?: number, _offset?: number): Promise<ChatMessagePopulated[]> => {
        const demo = getDemoContext();
        if (!demo.user || !demo.church) return [];
        
        return [
          {
            id: '1',
            church_id: demo.church.id,
            user_id: demo.user.id,
            content: 'Hey team! Don\'t forget rehearsal this Thursday at 7pm.',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
            user: { id: demo.user.id, name: demo.user.name, email: demo.user.email },
          },
          {
            id: '2',
            church_id: demo.church.id,
            user_id: demo.user.id,
            content: 'Also, please review new song we\'re adding this week. Link in the song library!',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(),
            user: { id: demo.user.id, name: demo.user.name, email: demo.user.email },
          },
        ];
      },
      create: async (message: Omit<ChatMessage, 'id' | 'created_at'>): Promise<ChatMessagePopulated> => {
        const demo = getDemoContext();
        const user = demo.user;
        return {
          id: `demo-${Date.now()}`,
          church_id: message.church_id,
          user_id: message.user_id,
          content: message.content,
          created_at: new Date().toISOString(),
          user: user ? { id: user.id, name: user.name, email: user.email } : { id: 'unknown', name: 'Unknown User' },
        };
      },
      report: async () => { /* no-op in demo mode */ return { id: 'demo' }; },
      subscribe: (_churchId: string, _callback: (message: ChatMessagePopulated) => void, _onError?: (error: Error) => void) => {
        // Demo doesn't support real-time subscriptions
        return () => {};
      },
    },

    serviceChat: createDemoServiceChat(getDemoContext),

    // ─── Task Dependencies (demo stubs) ────────────────────────────────
    taskDependencies: {
      getByTask: async (_taskId: string, _churchId: string): Promise<any[]> => [],
      create: async (_dep: any): Promise<any> => {
        throw new Error('Not supported in demo');
      },
      delete: async (_taskId: string, _dependsOnId: string, _churchId: string): Promise<boolean> => false,
      canComplete: async (_taskId: string, _churchId: string): Promise<boolean> => true,
    },

    // ─── Tasks & Checklists (demo) ─────────────────────────────────────
    tasks: {
      getByService: async (serviceId: string, _churchId: string): Promise<ServiceTask[]> => {
        const demo = getDemoContext();
        return demo.tasks
          .filter(t => t.service_id === serviceId)
          .sort((a, b) => a.position - b.position);
      },
      getByChurch: async (churchId: string): Promise<ServiceTask[]> => {
        const demo = getDemoContext();
        return demo.tasks
          .filter(t => t.church_id === churchId)
          .sort((a, b) => a.position - b.position);
      },
      getMyTasks: async (_churchId: string, teamMemberId: string): Promise<any[]> => {
        const demo = getDemoContext();
        const memberTasks = demo.tasks
          .filter(t => t.assigned_team_member_id === teamMemberId)
          .map(t => {
            const service = demo.services.find(s => s.id === t.service_id);
            return { ...t, service: service ? { date: service.date, title: service.title } : null };
          });
        return memberTasks.sort((a, b) => a.position - b.position);
      },
      getById: async (id: string, _churchId: string): Promise<ServiceTask | null> => {
        const demo = getDemoContext();
        return demo.tasks.find(t => t.id === id) || null;
      },
      create: async (t: any): Promise<ServiceTask> => {
        const demo = getDemoContext();
        return demo.createTask(t);
      },
      update: async (id: string, _churchId: string, updates: any): Promise<ServiceTask> => {
        const demo = getDemoContext();
        return demo.updateTask(id, updates);
      },
      toggleDone: async (id: string, _churchId: string, userId: string): Promise<ServiceTask | null> => {
        const demo = getDemoContext();
        return demo.toggleTask(id, userId);
      },
      delete: async (id: string, _churchId: string): Promise<boolean> => {
        const demo = getDemoContext();
        return demo.deleteTask(id);
      },
      reorder: async (serviceId: string, orderedIds: string[]): Promise<void> => {
        const demo = getDemoContext();
        demo.reorderTasks(serviceId, orderedIds);
      },
      getTaskStats: async (serviceId: string, _churchId: string): Promise<{ total: number; done: number }> => {
        const demo = getDemoContext();
        const serviceTasks = demo.tasks.filter(t => t.service_id === serviceId);
        return { total: serviceTasks.length, done: serviceTasks.filter(t => t.status === 'done').length };
      },
      generateFromTemplate: async (_serviceId: string, _churchId: string, _templateId: string): Promise<any[]> => [],
    },

    // ─── Task Templates (demo stubs) ───────────────────────────────────
    taskTemplates: {
      getByChurch: async (_churchId: string): Promise<any[]> => [],
      getById: async (_id: string, _churchId: string): Promise<any> => null,
      create: async (_t: any): Promise<any> => {
        throw new Error('Task template creation not supported in demo');
      },
      update: async (_id: string, _churchId: string, _updates: any): Promise<any> => {
        throw new Error('Task template updates not supported in demo');
      },
      delete: async (_id: string, _churchId: string): Promise<boolean> => false,
      addItem: async (_templateId: string, _item: any): Promise<any> => {
        throw new Error('Not supported in demo');
      },
      updateItem: async (_itemId: string, _updates: any): Promise<any> => {
        throw new Error('Not supported in demo');
      },
      deleteItem: async (_itemId: string): Promise<boolean> => false,
    },

    // ─── Member Groups / Bands (demo) ──────────────────────────────────
    memberGroups: {
      getByChurch: async (churchId: string): Promise<MemberGroup[]> => {
        const demo = getDemoContext();
        return demo.memberGroups.filter(g => g.church_id === churchId);
      },
      getById: async (id: string, _churchId: string): Promise<MemberGroup | null> => {
        const demo = getDemoContext();
        return demo.memberGroups.find(g => g.id === id) || null;
      },
      create: async (g: any): Promise<MemberGroup> => {
        const demo = getDemoContext();
        return demo.createGroup(g);
      },
      update: async (id: string, _churchId: string, updates: any): Promise<MemberGroup> => {
        const demo = getDemoContext();
        return demo.updateGroup(id, updates);
      },
      delete: async (id: string, _churchId: string): Promise<boolean> => {
        const demo = getDemoContext();
        return demo.deleteGroup(id);
      },
      addMember: async (groupId: string, teamMemberId: string, role?: string): Promise<MemberGroupMember> => {
        const demo = getDemoContext();
        return demo.addGroupMember(groupId, teamMemberId, role);
      },
      removeMember: async (groupId: string, teamMemberId: string): Promise<boolean> => {
        const demo = getDemoContext();
        return demo.removeGroupMember(groupId, teamMemberId);
      },
      getMembers: async (groupId: string): Promise<any[]> => {
        const demo = getDemoContext();
        const members = demo.memberGroupMembers.filter(m => m.group_id === groupId);
        return members.map(m => {
          const tm = demo.teamMembers.find(t => t.id === m.team_member_id);
          return { ...m, team_member: tm || null };
        });
      },
    },

    // ─── Team Member Private Notes (demo) ─────────────────────────────
    memberNotes: {
      getByMember: async (teamMemberId: string): Promise<TeamMemberNote[]> => {
        const demo = getDemoContext();
        return demo.memberNotes.filter(n => n.team_member_id === teamMemberId);
      },
      create: async (n: any): Promise<TeamMemberNote> => {
        const demo = getDemoContext();
        return demo.createMemberNote(n);
      },
      delete: async (id: string): Promise<boolean> => {
        const demo = getDemoContext();
        return demo.deleteMemberNote(id);
      },
    },

    // ─── Chat Channels (demo) ─────────────────────────────────────────
    channels: {
      getByChurch: async (churchId: string): Promise<any[]> => {
        const demo = getDemoContext();
        return demo.chatChannels.filter((c: any) => c.church_id === churchId);
      },
      getById: async (id: string, _churchId: string): Promise<any> => {
        const demo = getDemoContext();
        return demo.chatChannels.find((c: any) => c.id === id) || null;
      },
      create: async (_c: any): Promise<any> => {
        throw new Error('Channel creation not supported in demo');
      },
      delete: async (_id: string, _churchId: string): Promise<boolean> => false,
      getMembers: async (_channelId: string): Promise<any[]> => [],
      addMember: async (_channelId: string, _userId: string): Promise<any> => null,
      getMessages: async (_channelId: string): Promise<any[]> => {
        const demo = getDemoContext();
        return demo.chatMessages
          .filter((m: any) => m.channel_id === _channelId || !m.channel_id)
          .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      },
    },

    // ─── Rehearsal Tracking (demo) ─────────────────────────────────────
    rehearsals: {
      getByService: async (serviceId: string, _churchId: string): Promise<any[]> => {
        const demo = getDemoContext();
        const logs = demo.rehearsalLogs.filter(l => l.service_id === serviceId);
        return logs.map(l => {
          const member = demo.teamMembers.find(tm => tm.id === l.team_member_id);
          return { ...l, team_members: member ? { name: member.name } : { name: 'Unknown' } };
        });
      },

      getByTeamMember: async (serviceId: string, teamMemberId: string, _churchId: string): Promise<RehearsalLog[]> => {
        const demo = getDemoContext();
        return demo.rehearsalLogs.filter(l => l.service_id === serviceId && l.team_member_id === teamMemberId);
      },

      upsert: async (
        serviceId: string,
        teamMemberId: string,
        songId: string,
        rehearsed: boolean,
        _churchId: string,
      ): Promise<RehearsalLog> => {
        const demo = getDemoContext();
        const existing = demo.rehearsalLogs.findIndex(
          l => l.service_id === serviceId && l.team_member_id === teamMemberId && l.song_id === songId
        );
        if (existing >= 0) {
          demo.rehearsalLogs[existing] = {
            ...demo.rehearsalLogs[existing],
            rehearsed,
            rehearsed_at: rehearsed ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          };
          return demo.rehearsalLogs[existing];
        }
        const newLog: RehearsalLog = {
          id: `demo-rl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          church_id: _churchId,
          service_id: serviceId,
          team_member_id: teamMemberId,
          song_id: songId,
          rehearsed,
          rehearsed_at: rehearsed ? new Date().toISOString() : null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        demo.rehearsalLogs.push(newLog);
        return newLog;
      },

      markAll: async (serviceId: string, teamMemberId: string, _churchId: string): Promise<void> => {
        const demo = getDemoContext();
        const songItems = demo.serviceItems.filter(i => i.service_id === serviceId && i.type === 'song' && i.song_id);
        for (const item of songItems) {
          const existing = demo.rehearsalLogs.findIndex(
            l => l.service_id === serviceId && l.team_member_id === teamMemberId && l.song_id === item.song_id
          );
          if (existing >= 0) {
            demo.rehearsalLogs[existing] = {
              ...demo.rehearsalLogs[existing],
              rehearsed: true,
              rehearsed_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          } else {
            demo.rehearsalLogs.push({
              id: `demo-rl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              church_id: _churchId,
              service_id: serviceId,
              team_member_id: teamMemberId,
              song_id: item.song_id!,
              rehearsed: true,
              rehearsed_at: new Date().toISOString(),
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            });
          }
        }
      },

      getStatsByService: async (serviceId: string, _churchId: string): Promise<RehearsalStats[]> => {
        const demo = getDemoContext();
        const songItems = demo.serviceItems.filter(i => i.service_id === serviceId && i.type === 'song' && i.song_id);
        const totalSongs = songItems.length;

        const serviceAssignments = demo.assignments.filter(a => a.service_id === serviceId);
        if (serviceAssignments.length === 0 || totalSongs === 0) return [];

        const rehearsalCounts: Record<string, Set<string>> = {};
        for (const log of demo.rehearsalLogs) {
          if (log.service_id === serviceId && log.rehearsed) {
            if (!rehearsalCounts[log.team_member_id]) {
              rehearsalCounts[log.team_member_id] = new Set();
            }
            rehearsalCounts[log.team_member_id].add(log.song_id);
          }
        }

        return serviceAssignments.map(a => {
          const member = demo.teamMembers.find(tm => tm.id === a.team_member_id);
          return {
            team_member_id: a.team_member_id,
            member_name: member?.name || 'Unknown',
            member_role: a.role,
            rehearsed_count: rehearsalCounts[a.team_member_id]?.size || 0,
            total_songs: totalSongs,
          };
        });
      },
    },

    // Service Debriefs — Demo
    debriefs: {
      getByService: async (serviceId: string, _churchId: string): Promise<any[]> => {
        const demo = getDemoContext();
        return demo.debriefs
          .filter(d => d.service_id === serviceId)
          .map(d => {
            const member = demo.teamMembers.find(tm => tm.user_id === d.user_id);
            return { ...d, user: { id: d.user_id, name: member?.name || 'Unknown' } };
          });
      },
      getByChurch: async (churchId: string, _options?: { limit?: number; months?: number }): Promise<any[]> => {
        const demo = getDemoContext();
        const limit = _options?.limit || 50;
        let result = demo.debriefs
          .filter(d => d.church_id === churchId)
          .map(d => {
            const service = demo.services.find(s => s.id === d.service_id);
            return { ...d, service: service ? { title: service.title, date: service.date } : undefined };
          })
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        if (limit) result = result.slice(0, limit);
        return result;
      },
      getByUser: async (_churchId: string, userId: string): Promise<any[]> => {
        const demo = getDemoContext();
        return demo.debriefs.filter(d => d.user_id === userId);
      },
      getById: async (id: string, _churchId: string): Promise<any> => {
        const demo = getDemoContext();
        return demo.debriefs.find(d => d.id === id) || null;
      },
      upsert: async (d: any): Promise<any> => {
        const demo = getDemoContext();
        return demo.upsertDebrief(d);
      },
      delete: async (id: string, _churchId: string): Promise<boolean> => {
        return true;
      },
      getTrends: async (churchId: string, _months?: number): Promise<DebriefTrends[]> => {
        const demo = getDemoContext();
        const churchDebriefs = demo.debriefs.filter(d => d.church_id === churchId);
        if (churchDebriefs.length === 0) return [];

        const avgRating = (vals: number[]) => {
          if (vals.length === 0) return 0;
          return Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10;
        };

        const period = new Date().toISOString().slice(0, 7);
        return [{
          avg_engagement: avgRating(churchDebriefs.map(d => d.rating_engagement)),
          avg_flow: avgRating(churchDebriefs.map(d => d.rating_flow)),
          avg_tech: avgRating(churchDebriefs.map(d => d.rating_tech)),
          total_debriefs: churchDebriefs.length,
          period,
        }];
      },
    },
  };
}

// Export type for use in other files
export type DemoStoreType = ReturnType<typeof createDemoStore>;
