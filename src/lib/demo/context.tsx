'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Church, User, Song, TeamMember, TeamMemberPreference, TeamMemberBlockoutDate, Service, ServiceItem, ServiceAssignment, SongUsage, ServiceTemplate, ChatMessage, ChatMessagePopulated, RehearsalLog, ServiceTask, MemberGroup, MemberGroupMember, TeamMemberNote, ServiceDebrief, TimingComparisonItem } from '@/lib/types';
import { getInitialDemoData } from './data';

  // Demo context types
interface DemoContextType {
  // Auth-like state (matches AuthProvider)
  user: User | null;
  church: Church | null;
  loading: boolean;
  
  // Demo data state
  songs: Song[];
  teamMembers: TeamMember[];
  services: Service[];
  serviceItems: ServiceItem[];
  assignments: ServiceAssignment[];
  songUsage: SongUsage[];
  templates: ServiceTemplate[];
  chatMessages: ChatMessagePopulated[];
  rehearsalLogs: RehearsalLog[];
  tasks: ServiceTask[];
  memberGroups: MemberGroup[];
  memberGroupMembers: MemberGroupMember[];
  memberNotes: TeamMemberNote[];
  chatChannels: any[];
  debriefs: ServiceDebrief[];
  preferences: TeamMemberPreference[];
  blockoutDates: TeamMemberBlockoutDate[];
  
  // Demo actions
  resetDemo: () => void;
  
  // Song CRUD
  createSong: (song: Omit<Song, 'id' | 'created_at'>) => Song;
  updateSong: (id: string, updates: Partial<Song>) => Song;
  deleteSong: (id: string) => boolean;
  
  // Team Member CRUD
  createTeamMember: (tm: Omit<TeamMember, 'id' | 'created_at'>) => TeamMember;
  updateTeamMember: (id: string, updates: Partial<TeamMember>) => TeamMember;
  deleteTeamMember: (id: string) => boolean;
  
  // Service CRUD
  createService: (s: Omit<Service, 'id' | 'created_at' | 'updated_at'>) => Service;
  updateService: (id: string, updates: Partial<Service>) => Service;
  deleteService: (id: string) => boolean;
  duplicateService: (sourceId: string, newDate: string, newTitle?: string) => Service | null;
  
  // Service Item CRUD
  createServiceItem: (si: Omit<ServiceItem, 'id'>) => ServiceItem;
  updateServiceItem: (id: string, updates: Partial<ServiceItem>) => ServiceItem;
  deleteServiceItem: (id: string) => boolean;
  reorderServiceItems: (serviceId: string, orderedIds: string[]) => void;
  
  // Assignment CRUD
  createAssignment: (sa: Omit<ServiceAssignment, 'id'>) => ServiceAssignment;
  updateAssignment: (id: string, updates: Partial<ServiceAssignment>) => ServiceAssignment;
  deleteAssignment: (id: string) => boolean;
  deleteAssignmentsByService: (serviceId: string) => boolean;
  
  // Song Usage
  createSongUsage: (su: Omit<SongUsage, 'id'>) => SongUsage;
  createSongUsageForService: (serviceId: string, date: string) => void;
  
  // Template CRUD
  createTemplate: (t: Omit<ServiceTemplate, 'id' | 'created_at'>) => ServiceTemplate;
  updateTemplate: (id: string, updates: Partial<ServiceTemplate>) => ServiceTemplate;
  deleteTemplate: (id: string) => boolean;
  createServiceFromTemplate: (templateId: string, dateString: string) => Service | null;
  
  // Complete service (logs song usage)
  completeService: (serviceId: string) => void;
  
  // Chat
  createChatMessage: (message: Omit<ChatMessage, 'id' | 'created_at'>) => ChatMessagePopulated;
  updateChatMessage: (id: string, updates: Partial<ChatMessage>) => ChatMessagePopulated | null;
  deleteChatMessage: (id: string) => boolean;

  // Task CRUD
  createTask: (t: Omit<ServiceTask, 'id' | 'created_at'>) => ServiceTask;
  updateTask: (id: string, updates: Partial<ServiceTask>) => ServiceTask;
  deleteTask: (id: string) => boolean;
  toggleTask: (id: string, userId: string) => ServiceTask | null;
  reorderTasks: (serviceId: string, orderedIds: string[]) => void;

  // Member Group CRUD
  createGroup: (g: Omit<MemberGroup, 'id' | 'created_at' | 'updated_at'>) => MemberGroup;
  updateGroup: (id: string, updates: Partial<MemberGroup>) => MemberGroup;
  deleteGroup: (id: string) => boolean;
  addGroupMember: (groupId: string, teamMemberId: string, role?: string) => MemberGroupMember;
  removeGroupMember: (groupId: string, teamMemberId: string) => boolean;

  // Member Notes CRUD
  createMemberNote: (n: Omit<TeamMemberNote, 'id' | 'created_at' | 'updated_at'>) => TeamMemberNote;
  deleteMemberNote: (id: string) => boolean;

  // Debriefs
  upsertDebrief: (d: Omit<ServiceDebrief, 'id' | 'created_at' | 'updated_at'>) => ServiceDebrief;
  getDebriefByService: (serviceId: string) => ServiceDebrief | undefined;

  // Rehearsal helpers
  markRehearsed: (serviceId: string, teamMemberId: string, songId: string, rehearsed: boolean) => RehearsalLog;
  markAllRehearsed: (serviceId: string, teamMemberId: string) => void;
  getRehearsalStats: (serviceId: string) => { team_member_id: string; member_name: string; member_role: string; rehearsed_count: number; total_songs: number }[];

  // Preferences
  upsertPreference: (teamMemberId: string, prefs: { max_weekly_frequency?: number | null; availability_notes?: string }) => TeamMemberPreference;

  // Blockout Dates
  createBlockoutDate: (bd: { team_member_id: string; church_id: string; start_date: string; end_date: string; reason?: string }) => TeamMemberBlockoutDate;
  deleteBlockoutDate: (id: string) => boolean;
}

const DemoContext = createContext<DemoContextType | null>(null);

// Helper to generate unique IDs
const generateId = () => `demo-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export function DemoProvider({ children }: { children: ReactNode }) {
  const initialData = getInitialDemoData();
  
  // Auth state
  const [user] = useState<User | null>(initialData.user);
  const [church] = useState<Church | null>(initialData.church);
  const [loading] = useState(false);
  
  // Data state
  const [songs, setSongs] = useState<Song[]>(initialData.songs);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(initialData.teamMembers);
  const [services, setServices] = useState<Service[]>(initialData.services);
  const [serviceItems, setServiceItems] = useState<ServiceItem[]>(initialData.serviceItems);
  const [assignments, setAssignments] = useState<ServiceAssignment[]>(initialData.assignments);
  const [songUsage, setSongUsage] = useState<SongUsage[]>(initialData.songUsage);
  const [templates, setTemplates] = useState<ServiceTemplate[]>(initialData.templates);
  const [chatMessages, setChatMessages] = useState<ChatMessagePopulated[]>(initialData.chatMessages || []);
  const [rehearsalLogs, setRehearsalLogs] = useState<RehearsalLog[]>(initialData.rehearsalLogs || []);
  const [tasks, setTasks] = useState<ServiceTask[]>(initialData.tasks || []);
  const [memberGroups, setMemberGroups] = useState<MemberGroup[]>(initialData.memberGroups || []);
  const [memberGroupMembers, setMemberGroupMembers] = useState<MemberGroupMember[]>(initialData.memberGroupMembers || []);
  const [memberNotes, setMemberNotes] = useState<TeamMemberNote[]>(initialData.memberNotes || []);
  const [chatChannels, setChatChannels] = useState<any[]>(initialData.chatChannels || []);
  const [debriefs, setDebriefs] = useState<ServiceDebrief[]>(initialData.debriefs || []);
  const [preferences, setPreferences] = useState<TeamMemberPreference[]>(initialData.preferences || []);
  const [blockoutDates, setBlockoutDates] = useState<TeamMemberBlockoutDate[]>(initialData.blockoutDates || []);
  
  // Reset demo
  const resetDemo = useCallback(() => {
    const fresh = getInitialDemoData();
    setSongs(fresh.songs);
    setTeamMembers(fresh.teamMembers);
    setServices(fresh.services);
    setServiceItems(fresh.serviceItems);
    setAssignments(fresh.assignments);
    setSongUsage(fresh.songUsage);
    setTemplates(fresh.templates);
    setChatMessages(fresh.chatMessages || []);
    setRehearsalLogs(fresh.rehearsalLogs || []);
    setTasks(fresh.tasks || []);
    setMemberGroups(fresh.memberGroups || []);
    setMemberGroupMembers(fresh.memberGroupMembers || []);
    setMemberNotes(fresh.memberNotes || []);
    setChatChannels(fresh.chatChannels || []);
    setDebriefs(fresh.debriefs || []);
    setPreferences(fresh.preferences || []);
    setBlockoutDates(fresh.blockoutDates || []);
  }, []);
  
  // Song CRUD
  const createSong = useCallback((song: Omit<Song, 'id' | 'created_at'>): Song => {
    const newSong: Song = {
      ...song,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    setSongs(prev => [...prev, newSong]);
    return newSong;
  }, []);
  
  const updateSong = useCallback((id: string, updates: Partial<Song>): Song => {
    let updated: Song = null!;
    setSongs(prev => prev.map(s => {
      if (s.id === id) {
        updated = { ...s, ...updates };
        return updated;
      }
      return s;
    }));
    return updated;
  }, []);
  
  const deleteSong = useCallback((id: string): boolean => {
    setSongs(prev => prev.filter(s => s.id !== id));
    setServiceItems(prev => prev.filter(si => si.song_id !== id));
    setSongUsage(prev => prev.filter(su => su.song_id !== id));
    return true;
  }, []);
  
  // Team Member CRUD
  const createTeamMember = useCallback((tm: Omit<TeamMember, 'id' | 'created_at'>): TeamMember => {
    const newTm: TeamMember = {
      ...tm,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    setTeamMembers(prev => [...prev, newTm]);
    return newTm;
  }, []);
  
  const updateTeamMember = useCallback((id: string, updates: Partial<TeamMember>): TeamMember => {
    let updated: TeamMember = null!;
    setTeamMembers(prev => prev.map(tm => {
      if (tm.id === id) {
        updated = { ...tm, ...updates };
        return updated;
      }
      return tm;
    }));
    return updated;
  }, []);
  
  const deleteTeamMember = useCallback((id: string): boolean => {
    setTeamMembers(prev => prev.filter(tm => tm.id !== id));
    setAssignments(prev => prev.filter(a => a.team_member_id !== id));
    return true;
  }, []);
  
  // Service CRUD
  const createService = useCallback((s: Omit<Service, 'id' | 'created_at' | 'updated_at'>): Service => {
    const newService: Service = {
      ...s,
      id: generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setServices(prev => [...prev, newService]);
    return newService;
  }, []);
  
  const updateService = useCallback((id: string, updates: Partial<Service>): Service => {
    let updated: Service = null!;
    setServices(prev => prev.map(s => {
      if (s.id === id) {
        updated = { ...s, ...updates, updated_at: new Date().toISOString() };
        return updated;
      }
      return s;
    }));
    return updated;
  }, []);
  
  const deleteService = useCallback((id: string): boolean => {
    setServices(prev => prev.filter(s => s.id !== id));
    setServiceItems(prev => prev.filter(si => si.service_id !== id));
    setAssignments(prev => prev.filter(a => a.service_id !== id));
    setSongUsage(prev => prev.filter(su => su.service_id !== id));
    return true;
  }, []);
  
  const duplicateService = useCallback((sourceId: string, newDate: string, newTitle?: string): Service | null => {
    const source = services.find(s => s.id === sourceId);
    if (!source) return null;
    
    const newService: Service = {
      ...source,
      id: generateId(),
      title: newTitle || `${source.title} (copy)`,
      date: newDate,
      status: 'draft',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    setServices(prev => [...prev, newService]);
    
    // Copy items
    const items = serviceItems.filter(si => si.service_id === sourceId);
    const newItems = items.map(i => ({
      ...i,
      id: generateId(),
      service_id: newService.id,
    }));
    setServiceItems(prev => [...prev, ...newItems]);
    
    // Copy assignments
    const asgns = assignments.filter(a => a.service_id === sourceId);
    const newAsgns = asgns.map(a => ({
      ...a,
      id: generateId(),
      service_id: newService.id,
      status: 'pending' as const,
    }));
    setAssignments(prev => [...prev, ...newAsgns]);
    
    return newService;
  }, [services, serviceItems, assignments]);
  
  // Service Item CRUD
  const createServiceItem = useCallback((si: Omit<ServiceItem, 'id'>): ServiceItem => {
    const newSi: ServiceItem = {
      ...si,
      id: generateId(),
    };
    setServiceItems(prev => [...prev, newSi]);
    return newSi;
  }, []);
  
  const updateServiceItem = useCallback((id: string, updates: Partial<ServiceItem>): ServiceItem => {
    let updated: ServiceItem = null!;
    setServiceItems(prev => prev.map(si => {
      if (si.id === id) {
        updated = { ...si, ...updates };
        return updated;
      }
      return si;
    }));
    return updated;
  }, []);
  
  const deleteServiceItem = useCallback((id: string): boolean => {
    setServiceItems(prev => prev.filter(si => si.id !== id));
    return true;
  }, []);
  
  const reorderServiceItems = useCallback((serviceId: string, orderedIds: string[]) => {
    setServiceItems(prev => prev.map(si => {
      const index = orderedIds.indexOf(si.id);
      if (index !== -1 && si.service_id === serviceId) {
        return { ...si, position: index };
      }
      return si;
    }));
  }, []);
  
  // Assignment CRUD
  const createAssignment = useCallback((sa: Omit<ServiceAssignment, 'id'>): ServiceAssignment => {
    const newSa: ServiceAssignment = {
      ...sa,
      id: generateId(),
    };
    setAssignments(prev => [...prev, newSa]);
    return newSa;
  }, []);
  
  const updateAssignment = useCallback((id: string, updates: Partial<ServiceAssignment>): ServiceAssignment => {
    let updated: ServiceAssignment = null!;
    setAssignments(prev => prev.map(a => {
      if (a.id === id) {
        updated = { ...a, ...updates };
        return updated;
      }
      return a;
    }));
    return updated;
  }, []);
  
  const deleteAssignment = useCallback((id: string): boolean => {
    setAssignments(prev => prev.filter(a => a.id !== id));
    return true;
  }, []);
  
  const deleteAssignmentsByService = useCallback((serviceId: string): boolean => {
    setAssignments(prev => prev.filter(a => a.service_id !== serviceId));
    return true;
  }, []);
  
  // Song Usage
  const createSongUsage = useCallback((su: Omit<SongUsage, 'id'>): SongUsage => {
    const newSu: SongUsage = {
      ...su,
      id: generateId(),
    };
    setSongUsage(prev => [...prev, newSu]);
    return newSu;
  }, []);
  
  const createSongUsageForService = useCallback((serviceId: string, date: string) => {
    const items = serviceItems.filter(si => si.type === 'song' && si.song_id && si.service_id === serviceId);
    if (items.length > 0) {
      const usages = items.map(item => ({
        id: generateId(),
        church_id: church!.id,
        service_id: serviceId,
        song_id: item.song_id!,
        date,
      }));
      setSongUsage(prev => [...prev, ...usages]);
    }
  }, [serviceItems, church]);
  
  // Template CRUD
  const createTemplate = useCallback((t: Omit<ServiceTemplate, 'id' | 'created_at'>): ServiceTemplate => {
    const newT: ServiceTemplate = {
      ...t,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    setTemplates(prev => [...prev, newT]);
    return newT;
  }, []);
  
  const updateTemplate = useCallback((id: string, updates: Partial<ServiceTemplate>): ServiceTemplate => {
    let updated: ServiceTemplate = null!;
    setTemplates(prev => prev.map(t => {
      if (t.id === id) {
        updated = { ...t, ...updates };
        return updated;
      }
      return t;
    }));
    return updated;
  }, []);
  
  const deleteTemplate = useCallback((id: string): boolean => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    return true;
  }, []);
  
  const createServiceFromTemplate = useCallback((templateId: string, dateString: string): Service | null => {
    const template = templates.find(t => t.id === templateId);
    if (!template) return null;
    
    const newService: Service = {
      id: generateId(),
      church_id: template.church_id,
      title: template.title,
      date: dateString,
      time: template.time,
      status: 'draft',
      notes: template.notes || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    
    setServices(prev => [...prev, newService]);
    
    // Copy items
    if (template.items && template.items.length > 0) {
      const itemsToInsert = template.items.map((i, index) => ({
        id: generateId(),
        service_id: newService.id,
        type: i.type,
        position: index,
        title: i.title,
        song_id: i.song_id,
        notes: i.notes,
        duration_minutes: i.duration_minutes,
        key: i.key,
      }));
      setServiceItems(prev => [...prev, ...itemsToInsert]);
    }
    
    return newService;
  }, [templates]);
  
  // Complete service - marks as completed and logs song usage
  const completeService = useCallback((serviceId: string) => {
    const service = services.find(s => s.id === serviceId);
    if (!service) return;
    
    // Update status to completed
    setServices(prev => prev.map(s => {
      if (s.id === serviceId) {
        return { ...s, status: 'completed' as const, updated_at: new Date().toISOString() };
      }
      return s;
    }));
    
    // Log song usage
    createSongUsageForService(serviceId, service.date);
  }, [services, createSongUsageForService]);
  
  // Chat
  const updateChatMessage = useCallback((id: string, updates: Partial<ChatMessage>): ChatMessagePopulated | null => {
    let updated: ChatMessagePopulated | null = null;
    setChatMessages(prev => prev.map(m => {
      if (m.id === id) {
        updated = { ...m, ...updates, updated_at: new Date().toISOString() } as ChatMessagePopulated;
        return updated;
      }
      return m;
    }));
    return updated;
  }, []);

  const deleteChatMessage = useCallback((id: string): boolean => {
    setChatMessages(prev => prev.filter(m => m.id !== id));
    return true;
  }, []);

  const createChatMessage = useCallback((message: Omit<ChatMessage, 'id' | 'created_at'>): ChatMessagePopulated => {
    const newMessage: ChatMessagePopulated = {
      ...message,
      channel_id: message.channel_id,
      id: generateId(),
      created_at: new Date().toISOString(),
      user: user || { id: 'demo-user', email: 'demo@example.com', name: 'Demo User' },
    };
    setChatMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, [user]);

  // Task CRUD
  const createTask = useCallback((t: Omit<ServiceTask, 'id' | 'created_at'>): ServiceTask => {
    const newTask: ServiceTask = {
      ...t,
      id: generateId(),
      created_at: new Date().toISOString(),
    };
    setTasks(prev => [...prev, newTask]);
    return newTask;
  }, []);

  const updateTask = useCallback((id: string, updates: Partial<ServiceTask>): ServiceTask => {
    let updated: ServiceTask = null!;
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        updated = { ...t, ...updates };
        return updated;
      }
      return t;
    }));
    return updated;
  }, []);

  const deleteTask = useCallback((id: string): boolean => {
    setTasks(prev => prev.filter(t => t.id !== id));
    return true;
  }, []);

  const toggleTask = useCallback((id: string, userId: string): ServiceTask | null => {
    let toggled: ServiceTask | null = null;
    setTasks(prev => prev.map(t => {
      if (t.id === id) {
        const isDone = t.status === 'done';
        toggled = {
          ...t,
          status: isDone ? 'pending' as const : 'done' as const,
          completed_at: isDone ? null : new Date().toISOString(),
          completed_by: isDone ? null : userId,
        };
        return toggled;
      }
      return t;
    }));
    return toggled;
  }, []);

  const reorderTasks = useCallback((serviceId: string, orderedIds: string[]) => {
    setTasks(prev => prev.map(t => {
      const index = orderedIds.indexOf(t.id);
      if (index !== -1 && t.service_id === serviceId) {
        return { ...t, position: index };
      }
      return t;
    }));
  }, []);

  // Member Group CRUD
  const createGroup = useCallback((g: Omit<MemberGroup, 'id' | 'created_at' | 'updated_at'>): MemberGroup => {
    const newGroup: MemberGroup = {
      ...g,
      id: generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setMemberGroups(prev => [...prev, newGroup]);
    return newGroup;
  }, []);

  const updateGroup = useCallback((id: string, updates: Partial<MemberGroup>): MemberGroup => {
    let updated: MemberGroup = null!;
    setMemberGroups(prev => prev.map(g => {
      if (g.id === id) {
        updated = { ...g, ...updates, updated_at: new Date().toISOString() };
        return updated;
      }
      return g;
    }));
    return updated;
  }, []);

  const deleteGroup = useCallback((id: string): boolean => {
    setMemberGroups(prev => prev.filter(g => g.id !== id));
    setMemberGroupMembers(prev => prev.filter(m => m.group_id !== id));
    return true;
  }, []);

  const addGroupMember = useCallback((groupId: string, teamMemberId: string, role?: string): MemberGroupMember => {
    const newMember: MemberGroupMember = {
      group_id: groupId,
      team_member_id: teamMemberId,
      role: role || null,
      joined_at: new Date().toISOString(),
    };
    setMemberGroupMembers(prev => [...prev, newMember]);
    return newMember;
  }, []);

  const removeGroupMember = useCallback((groupId: string, teamMemberId: string): boolean => {
    setMemberGroupMembers(prev => prev.filter(m => !(m.group_id === groupId && m.team_member_id === teamMemberId)));
    return true;
  }, []);

  // Member Notes CRUD
  const createMemberNote = useCallback((n: Omit<TeamMemberNote, 'id' | 'created_at' | 'updated_at'>): TeamMemberNote => {
    const newNote: TeamMemberNote = {
      ...n,
      id: generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setMemberNotes(prev => [...prev, newNote]);
    return newNote;
  }, []);

  // Preferences
  const upsertPreference = useCallback((teamMemberId: string, prefs: { max_weekly_frequency?: number | null; availability_notes?: string }): TeamMemberPreference => {
    const existing = preferences.findIndex(p => p.team_member_id === teamMemberId);
    const now = new Date().toISOString();
    if (existing >= 0) {
      const updated: TeamMemberPreference = {
        ...preferences[existing],
        ...prefs,
        updated_at: now,
      };
      setPreferences(prev => prev.map((p, i) => i === existing ? updated : p));
      return updated;
    }
    const newPref: TeamMemberPreference = {
      id: generateId(),
      team_member_id: teamMemberId,
      church_id: church?.id || '',
      max_weekly_frequency: prefs.max_weekly_frequency ?? null,
      availability_notes: prefs.availability_notes || '',
      created_at: now,
      updated_at: now,
    };
    setPreferences(prev => [...prev, newPref]);
    return newPref;
  }, [preferences, church]);

  // Blockout Dates
  const createBlockoutDate = useCallback((bd: { team_member_id: string; church_id: string; start_date: string; end_date: string; reason?: string }): TeamMemberBlockoutDate => {
    const newBd: TeamMemberBlockoutDate = {
      id: generateId(),
      team_member_id: bd.team_member_id,
      church_id: bd.church_id,
      start_date: bd.start_date,
      end_date: bd.end_date,
      reason: bd.reason || '',
      created_at: new Date().toISOString(),
    };
    setBlockoutDates(prev => [...prev, newBd]);
    return newBd;
  }, []);

  const deleteBlockoutDate = useCallback((id: string): boolean => {
    setBlockoutDates(prev => prev.filter(b => b.id !== id));
    return true;
  }, []);

  const deleteMemberNote = useCallback((id: string): boolean => {
    setMemberNotes(prev => prev.filter(n => n.id !== id));
    return true;
  }, []);

  // Debriefs
  const upsertDebrief = useCallback((d: Omit<ServiceDebrief, 'id' | 'created_at' | 'updated_at'>): ServiceDebrief => {
    const existing = debriefs.findIndex(de => de.service_id === d.service_id && de.user_id === d.user_id);
    if (existing >= 0) {
      const updated: ServiceDebrief = {
        ...debriefs[existing],
        ...d,
        updated_at: new Date().toISOString(),
      };
      setDebriefs(prev => prev.map((de, i) => i === existing ? updated : de));
      return updated;
    }
    const newDebrief: ServiceDebrief = {
      ...d,
      id: generateId(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setDebriefs(prev => [...prev, newDebrief]);
    return newDebrief;
  }, [debriefs]);

  const getDebriefByService = useCallback((serviceId: string): ServiceDebrief | undefined => {
    return debriefs.find(d => d.service_id === serviceId && d.user_id === user?.id);
  }, [debriefs, user]);

  // Rehearsal helpers
  const markRehearsed = useCallback((serviceId: string, teamMemberId: string, songId: string, rehearsed: boolean): RehearsalLog => {
    const existing = rehearsalLogs.findIndex(
      l => l.service_id === serviceId && l.team_member_id === teamMemberId && l.song_id === songId
    );
    if (existing >= 0) {
      const updated = {
        ...rehearsalLogs[existing],
        rehearsed,
        rehearsed_at: rehearsed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      };
      setRehearsalLogs(prev => prev.map((l, i) => i === existing ? updated : l));
      return updated;
    }
    const newLog: RehearsalLog = {
      id: generateId(),
      church_id: church?.id || '',
      service_id: serviceId,
      team_member_id: teamMemberId,
      song_id: songId,
      rehearsed,
      rehearsed_at: rehearsed ? new Date().toISOString() : null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    setRehearsalLogs(prev => [...prev, newLog]);
    return newLog;
  }, [rehearsalLogs, church]);

  const markAllRehearsed = useCallback((serviceId: string, teamMemberId: string) => {
    const songItems = serviceItems.filter(i => i.service_id === serviceId && i.type === 'song' && i.song_id);
    for (const item of songItems) {
      markRehearsed(serviceId, teamMemberId, item.song_id!, true);
    }
  }, [serviceItems, markRehearsed]);

  const getRehearsalStats = useCallback((serviceId: string) => {
    const songItems = serviceItems.filter(i => i.service_id === serviceId && i.type === 'song' && i.song_id);
    const totalSongs = songItems.length;
    const serviceAssignments = assignments.filter(a => a.service_id === serviceId);
    if (serviceAssignments.length === 0 || totalSongs === 0) return [];

    const rehearsalCounts: Record<string, Set<string>> = {};
    for (const log of rehearsalLogs) {
      if (log.service_id === serviceId && log.rehearsed) {
        if (!rehearsalCounts[log.team_member_id]) {
          rehearsalCounts[log.team_member_id] = new Set();
        }
        rehearsalCounts[log.team_member_id].add(log.song_id);
      }
    }

    return serviceAssignments.map(a => {
      const member = teamMembers.find(tm => tm.id === a.team_member_id);
      return {
        team_member_id: a.team_member_id,
        member_name: member?.name || 'Unknown',
        member_role: a.role,
        rehearsed_count: rehearsalCounts[a.team_member_id]?.size || 0,
        total_songs: totalSongs,
      };
    });
  }, [serviceItems, assignments, rehearsalLogs, teamMembers]);
  
  const value: DemoContextType = {
    user,
    church,
    loading,
    songs,
    teamMembers,
    services,
    serviceItems,
    assignments,
    songUsage,
    templates,
    chatMessages,
    rehearsalLogs,
    tasks,
    memberGroups,
    memberGroupMembers,
    memberNotes,
    chatChannels,
    debriefs,
    preferences,
    blockoutDates,
    resetDemo,
    createSong,
    updateSong,
    deleteSong,
    createTeamMember,
    updateTeamMember,
    deleteTeamMember,
    createService,
    updateService,
    deleteService,
    duplicateService,
    createServiceItem,
    updateServiceItem,
    deleteServiceItem,
    reorderServiceItems,
    createAssignment,
    updateAssignment,
    deleteAssignment,
    deleteAssignmentsByService,
    createSongUsage,
    createSongUsageForService,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    createServiceFromTemplate,
    completeService,
    createChatMessage,
    updateChatMessage,
    deleteChatMessage,
    createTask,
    updateTask,
    deleteTask,
    toggleTask,
    reorderTasks,
    createGroup,
    updateGroup,
    deleteGroup,
    addGroupMember,
    removeGroupMember,
    createMemberNote,
    deleteMemberNote,
    upsertDebrief,
    getDebriefByService,
    markRehearsed,
    markAllRehearsed,
    getRehearsalStats,
    upsertPreference,
    createBlockoutDate,
    deleteBlockoutDate,
  };
  
  return (
    <DemoContext.Provider value={value}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) {
    throw new Error('useDemo must be used within a DemoProvider');
  }
  return context;
}