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
};

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
      getBySong: async (_songId: string): Promise<SongFile[]> => {
        // Demo doesn't support file uploads
        return [];
      },
      create: async (_sf: Omit<SongFile, 'id' | 'created_at'>): Promise<SongFile> => {
        throw new Error('File uploads not supported in demo');
      },
      delete: async (_id: string): Promise<boolean> => {
        throw new Error('File uploads not supported in demo');
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
        // Demo chat messages - return sample data
        const demo = getDemoContext();
        if (!demo.user || !demo.church) return [];
        
        return [
          {
            id: '1',
            church_id: demo.church.id,
            user_id: demo.user.id,
            content: 'Hey team! Don\'t forget rehearsal this Thursday at 7pm.',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
            user: { id: demo.user.id, name: demo.user.name, email: demo.user.email },
          },
          {
            id: '2',
            church_id: demo.church.id,
            user_id: demo.user.id,
            content: 'Also, please review new song we\'re adding this week. Link in the song library!',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 1).toISOString(), // 1 hour ago
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
      subscribe: (_churchId: string, _callback: (message: ChatMessagePopulated) => void) => {
        // Demo doesn't support real-time subscriptions
        return () => {};
      },
    },

    serviceChat: {
      getOrCreate: async (_serviceId: string, _churchId: string): Promise<any> => {
        return { id: 'demo-chat-1', service_id: _serviceId, created_at: new Date().toISOString() };
      },
      getMessages: async (_serviceId: string, _churchId: string): Promise<any[]> => {
        const demo = getDemoContext();
        if (!demo.user) return [];
        return [
          {
            id: '1',
            chat_id: 'demo-chat-1',
            content: 'Let\'s run through the new worship set before the service.',
            created_at: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
            sender_user_id: demo.user.id,
            sender: { id: demo.user.id, name: demo.user.name, avatar_url: demo.user.avatar_url },
          },
        ];
      },
      createMessage: async (_serviceId: string, _churchId: string, senderUserId: string, content: string): Promise<any> => {
        const demo = getDemoContext();
        return {
          id: `demo-msg-${Date.now()}`,
          chat_id: 'demo-chat-1',
          content,
          created_at: new Date().toISOString(),
          sender_user_id: senderUserId,
          sender: { id: demo.user?.id || 'unknown', name: demo.user?.name || 'Unknown', avatar_url: demo.user?.avatar_url },
        };
      },
      subscribe: (_serviceId: string, _churchId: string, _callback: (message: any) => void) => {
        return () => {};
      },
    },
  };
}

// Export type for use in other files
export type DemoStoreType = ReturnType<typeof createDemoStore>;
