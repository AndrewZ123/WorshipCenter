import {
  Sparkles, Home, Calendar, CheckSquare, Music, Users,
  MessageCircle, BarChart2, FileBarChart,
} from 'lucide-react';
import type { TourStep } from './types';

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to WorshipCenter!',
    description: 'This quick tour will show you around. You will learn about each section and how to use them to plan and manage your worship services.',
    icon: Sparkles,
  },
  {
    id: 'dashboard',
    title: 'Dashboard',
    description: 'Your command center. See upcoming services, key stats, recent activity, and your personal tasks at a glance. Everything you need in one place.',
    targetSelector: '[data-tour="nav-dashboard"]',
    icon: Home,
  },
  {
    id: 'services',
    title: 'Services',
    description: 'Plan and manage your worship services. Create orders of service, add songs and segments, assign team members, and track rehearsal progress.',
    targetSelector: '[data-tour="nav-services"]',
    icon: Calendar,
  },
  {
    id: 'tasks',
    title: 'My Tasks',
    description: 'Keep track of what needs to be done. View personal tasks assigned to you for each service, stay organized, and never miss a deadline.',
    targetSelector: '[data-tour="nav-tasks"]',
    icon: CheckSquare,
  },
  {
    id: 'songs',
    title: 'Songs',
    description: 'Build and manage your worship song library. Add chord charts, lyrics, and arrangements. Organize your repertoire for easy access.',
    targetSelector: '[data-tour="nav-songs"]',
    icon: Music,
  },
  {
    id: 'team',
    title: 'Team',
    description: 'Manage your worship team. Add musicians, vocalists, and tech team members. Assign roles and keep everyone connected.',
    targetSelector: '[data-tour="nav-team"]',
    icon: Users,
  },
  {
    id: 'chat',
    title: 'Team Chat',
    description: 'Communicate with your team in real-time. Discuss services, share updates, and coordinate rehearsals — all within WorshipCenter.',
    targetSelector: '[data-tour="nav-chat"]',
    icon: MessageCircle,
  },
  {
    id: 'usage',
    title: 'Song Usage',
    description: 'Track how often songs are used across services. See which songs are being played and keep your setlists fresh and varied.',
    targetSelector: '[data-tour="nav-usage"]',
    icon: BarChart2,
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Gain insights with detailed analytics. View reports on services, song usage, team participation, and more.',
    targetSelector: '[data-tour="nav-reports"]',
    icon: FileBarChart,
  },
  {
    id: 'done',
    title: 'You are all set!',
    description: 'You now know the key parts of WorshipCenter. Start planning your next service, or explore each section at your own pace.',
    icon: Sparkles,
  },
];
