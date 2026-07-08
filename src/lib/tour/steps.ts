import {
  Sparkles, Home, Calendar, CheckSquare, Music, Users,
  MessageCircle, BarChart2, FileBarChart, MoreHorizontal, UserCheck,
} from 'lucide-react';
import type { TourStep, TourRole } from './types';

/** Filter steps by role */
export function getStepsForRole(steps: TourStep[], role: TourRole): TourStep[] {
  return steps.filter(s => !s.roles || s.roles.includes(role));
}

/** Desktop sidebar tour — highlights sidebar nav items */
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
    roles: ['admin', 'leader'],
  },
  {
    id: 'services',
    title: 'Services',
    description: 'Plan and manage your worship services. Create orders of service, add songs and segments, assign team members, and track rehearsal progress.',
    targetSelector: '[data-tour="nav-services"]',
    icon: Calendar,
    roles: ['admin', 'leader'],
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
    roles: ['admin', 'leader'],
  },
  {
    id: 'team',
    title: 'Team',
    description: 'Manage your worship team. Add musicians, vocalists, and tech team members. Assign roles and keep everyone connected.',
    targetSelector: '[data-tour="nav-team"]',
    icon: Users,
    roles: ['admin', 'leader'],
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
    roles: ['admin', 'leader'],
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Gain insights with detailed analytics. View reports on services, song usage, team participation, and more.',
    targetSelector: '[data-tour="nav-reports"]',
    icon: FileBarChart,
    roles: ['admin', 'leader'],
  },
  {
    id: 'done',
    title: 'You are all set!',
    description: 'You now know the key parts of WorshipCenter. Start planning your next service, or explore each section at your own pace.',
    icon: Sparkles,
  },
];

/** Volunteer-specific desktop tour — focused on their view */
export const VOLUNTEER_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to WorshipCenter!',
    description: 'This quick tour will show you around as a volunteer. You will learn how to find your schedule, tasks, and song charts.',
    icon: Sparkles,
  },
  {
    id: 'tasks',
    title: 'My Tasks',
    description: 'See tasks assigned to you for upcoming services. Check off completed items and stay on top of your responsibilities.',
    targetSelector: '[data-tour="nav-tasks"]',
    icon: CheckSquare,
  },
  {
    id: 'services',
    title: 'Services',
    description: 'View your assigned services, check the schedule, confirm your availability, and chat with the team — all from the service page.',
    targetSelector: '[data-tour="nav-services"]',
    icon: Calendar,
  },
  {
    id: 'chat',
    title: 'Team Chat',
    description: 'Communicate with your worship team in real-time. Discuss arrangements, ask questions, and stay connected.',
    targetSelector: '[data-tour="nav-chat"]',
    icon: MessageCircle,
  },
  {
    id: 'songs',
    title: 'My Charts',
    description: 'Access your song charts and chord sheets. View files attached to songs you are assigned to for easy rehearsal.',
    targetSelector: '[data-tour="nav-songs"]',
    icon: Music,
  },
  {
    id: 'profile',
    title: 'Your Profile',
    description: 'Manage your availability, set blockout dates, and update your contact info so your team can reach you.',
    targetSelector: '[data-tour="nav-team"]',
    icon: UserCheck,
  },
  {
    id: 'done',
    title: 'You are all set!',
    description: 'You now know the key parts of WorshipCenter as a volunteer. View your tasks or upcoming services to get started.',
    icon: Sparkles,
  },
];

/** Mobile tour — highlights bottom nav items and opens the drawer for the rest */
export const MOBILE_TOUR_STEPS: TourStep[] = [
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
    roles: ['admin', 'leader'],
  },
  {
    id: 'services',
    title: 'Services',
    description: 'Plan and manage your worship services. Create orders of service, add songs and segments, assign team members, and track rehearsal progress.',
    targetSelector: '[data-tour="nav-services"]',
    icon: Calendar,
    roles: ['admin', 'leader'],
  },
  {
    id: 'tasks',
    title: 'My Tasks',
    description: 'Keep track of what needs to be done. View personal tasks assigned to you for each service, stay organized, and never miss a deadline.',
    targetSelector: '[data-tour="nav-tasks"]',
    icon: CheckSquare,
  },
  {
    id: 'more',
    title: 'More Sections',
    description: 'Songs, Team, Song Usage, and Reports are all found in the More menu. The menu has been opened for you — take a look inside.',
    targetSelector: '[data-tour="nav-more"]',
    icon: MoreHorizontal,
    roles: ['admin', 'leader'],
  },
  {
    id: 'songs',
    title: 'Songs',
    description: 'Build and manage your worship song library. Add chord charts, lyrics, and arrangements. Organize your repertoire for easy access.',
    targetSelector: '[data-tour="nav-songs"]',
    icon: Music,
    openDrawer: true,
    roles: ['admin', 'leader'],
  },
  {
    id: 'team',
    title: 'Team',
    description: 'Manage your worship team. Add musicians, vocalists, and tech team members. Assign roles and keep everyone connected.',
    targetSelector: '[data-tour="nav-team"]',
    icon: Users,
    roles: ['admin', 'leader'],
  },
  {
    id: 'usage',
    title: 'Song Usage',
    description: 'Track how often songs are used across services. See which songs are being played and keep your setlists fresh and varied.',
    targetSelector: '[data-tour="nav-usage"]',
    icon: BarChart2,
    roles: ['admin', 'leader'],
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Gain insights with detailed analytics. View reports on services, song usage, team participation, and more.',
    targetSelector: '[data-tour="nav-reports"]',
    icon: FileBarChart,
    roles: ['admin', 'leader'],
  },
  {
    id: 'chat',
    title: 'Team Chat',
    description: 'Communicate with your team in real-time. Discuss services, share updates, and coordinate rehearsals — all within WorshipCenter.',
    targetSelector: '[data-tour="nav-chat"]',
    icon: MessageCircle,
    closeDrawer: true,
  },
  {
    id: 'done',
    title: 'You are all set!',
    description: 'You now know the key parts of WorshipCenter. Start planning your next service, or explore each section at your own pace.',
    icon: Sparkles,
  },
];

/** Volunteer-specific mobile tour */
export const VOLUNTEER_MOBILE_TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to WorshipCenter!',
    description: 'This quick tour will show you around as a volunteer. Learn how to find your tasks, service schedule, and song charts.',
    icon: Sparkles,
  },
  {
    id: 'tasks',
    title: 'My Tasks',
    description: 'See tasks assigned to you for upcoming services. Check off completed items and stay on top of your responsibilities.',
    targetSelector: '[data-tour="nav-tasks"]',
    icon: CheckSquare,
  },
  {
    id: 'services',
    title: 'Services',
    description: 'View your assigned services, check the schedule, confirm your availability, and chat with the team.',
    targetSelector: '[data-tour="nav-services"]',
    icon: Calendar,
  },
  {
    id: 'more',
    title: 'More Sections',
    description: 'Your profile, song charts, and team directory are found in the More menu. The menu has been opened for you.',
    targetSelector: '[data-tour="nav-more"]',
    icon: MoreHorizontal,
  },
  {
    id: 'songs',
    title: 'My Charts',
    description: 'Access your song charts and chord sheets. View files attached to songs you are assigned to.',
    targetSelector: '[data-tour="nav-songs"]',
    icon: Music,
    openDrawer: true,
  },
  {
    id: 'profile',
    title: 'Your Profile',
    description: 'Manage your availability, set blockout dates, and update your contact info.',
    targetSelector: '[data-tour="nav-team"]',
    icon: UserCheck,
  },
  {
    id: 'chat',
    title: 'Team Chat',
    description: 'Communicate with your worship team in real-time. Discuss arrangements and stay connected.',
    targetSelector: '[data-tour="nav-chat"]',
    icon: MessageCircle,
    closeDrawer: true,
  },
  {
    id: 'done',
    title: 'You are all set!',
    description: 'You now know the key parts of WorshipCenter as a volunteer. View your tasks or upcoming services to get started.',
    icon: Sparkles,
  },
];
