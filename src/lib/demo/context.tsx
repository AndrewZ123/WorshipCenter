'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import type { Church, User, Song, TeamMember, Service, ServiceItem, ServiceAssignment, SongUsage, ServiceTemplate, ChatMessage, ChatMessagePopulated } from '@/lib/types';
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
  const createChatMessage = useCallback((message: Omit<ChatMessage, 'id' | 'created_at'>): ChatMessagePopulated => {
    const newMessage: ChatMessagePopulated = {
      ...message,
      id: generateId(),
      created_at: new Date().toISOString(),
      user: user || { id: 'demo-user', email: 'demo@example.com', name: 'Demo User' },
    };
    setChatMessages(prev => [...prev, newMessage]);
    return newMessage;
  }, [user]);
  
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