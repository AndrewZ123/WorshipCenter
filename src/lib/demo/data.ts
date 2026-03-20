import type { Church, User, Song, TeamMember, Service, ServiceItem, ServiceAssignment, SongUsage, ServiceTemplate, ChatMessagePopulated } from '@/lib/types';

// Demo Church
export const DEMO_CHURCH: Church = {
  id: 'demo-church-1',
  name: 'Grace Community Church',
  slug: 'grace-community',
  created_at: new Date().toISOString(),
};

// Demo User (admin)
export const DEMO_USER: User = {
  id: 'demo-user-1',
  church_id: DEMO_CHURCH.id,
  email: 'demo@worshipcenter.app',
  name: 'Jordan Smith',
  role: 'admin',
  created_at: new Date().toISOString(),
};

// Demo Songs - Popular worship songs
export const DEMO_SONGS: Song[] = [
  {
    id: 'song-1',
    church_id: DEMO_CHURCH.id,
    title: 'Amazing Grace (My Chains Are Gone)',
    artist: 'Chris Tomlin',
    default_key: 'G',
    ccli_number: '4768151',
    tags: ['Classic', 'Hymn', 'Worship'],
    youtube_video_id: 'Jbe7OruLk8I',
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'song-2',
    church_id: DEMO_CHURCH.id,
    title: '10,000 Reasons (Bless the Lord)',
    artist: 'Matt Redman',
    default_key: 'E',
    ccli_number: '6016351',
    tags: ['Worship', 'Praise'],
    youtube_video_id: 'DXDGE_lRI0E',
    created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'song-3',
    church_id: DEMO_CHURCH.id,
    title: 'How Great Is Our God',
    artist: 'Chris Tomlin',
    default_key: 'C',
    ccli_number: '4348399',
    tags: ['Worship', 'Praise'],
    youtube_video_id: 'KBD5pJAKaZQ',
    created_at: new Date(Date.now() - 80 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'song-4',
    church_id: DEMO_CHURCH.id,
    title: 'Good Good Father',
    artist: 'Pat Barrett / Housefires',
    default_key: 'A',
    ccli_number: '7036612',
    tags: ['Worship', 'Father'],
    youtube_video_id: 'ZLgBqkQNHew',
    created_at: new Date(Date.now() - 75 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'song-5',
    church_id: DEMO_CHURCH.id,
    title: 'What A Beautiful Name',
    artist: 'Hillsong Worship',
    default_key: 'D',
    ccli_number: '7068424',
    tags: ['Worship', 'Jesus'],
    youtube_video_id: 'nQWFzMvCfLE',
    created_at: new Date(Date.now() - 70 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'song-6',
    church_id: DEMO_CHURCH.id,
    title: 'Oceans (Where Feet May Fail)',
    artist: 'Hillsong UNITED',
    default_key: 'D',
    ccli_number: '6428894',
    tags: ['Worship', 'Prayer'],
    youtube_video_id: 'dy9nwe9_9hA',
    created_at: new Date(Date.now() - 65 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'song-7',
    church_id: DEMO_CHURCH.id,
    title: 'Build My Life',
    artist: 'Pat Barrett / Housefires',
    default_key: 'G',
    ccli_number: '7071852',
    tags: ['Worship', 'Devotion'],
    youtube_video_id: 'FPMf8wrWvEk',
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'song-8',
    church_id: DEMO_CHURCH.id,
    title: 'Reckless Love',
    artist: 'Cory Asbury',
    default_key: 'E',
    ccli_number: '7089641',
    tags: ['Worship', 'Love'],
    youtube_video_id: 'Sc6SSHuZvTd',
    created_at: new Date(Date.now() - 55 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'song-9',
    church_id: DEMO_CHURCH.id,
    title: 'Way Maker',
    artist: 'Sinach / Leeland',
    default_key: 'B',
    ccli_number: '7115714',
    tags: ['Worship', 'Miracle'],
    youtube_video_id: 'iJCVp0H0GYQ',
    created_at: new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'song-10',
    church_id: DEMO_CHURCH.id,
    title: 'Great Are You Lord',
    artist: 'All Sons & Daughters',
    default_key: 'G',
    ccli_number: '6469386',
    tags: ['Worship', 'Praise'],
    youtube_video_id: 'A5nyjXgG6rY',
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'song-11',
    church_id: DEMO_CHURCH.id,
    title: 'King of My Heart',
    artist: 'Sarah McMillan',
    default_key: 'A',
    ccli_number: '7049147',
    tags: ['Worship', 'Devotion'],
    youtube_video_id: 'Y0bKKqZLXTg',
    created_at: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'song-12',
    church_id: DEMO_CHURCH.id,
    title: 'Who You Say I Am',
    artist: 'Hillsong Worship',
    default_key: 'G',
    ccli_number: '7102401',
    tags: ['Worship', 'Identity'],
    youtube_video_id: 'JbUS6gvMT3Q',
    created_at: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Demo Team Members
export const DEMO_TEAM_MEMBERS: TeamMember[] = [
  {
    id: 'tm-1',
    church_id: DEMO_CHURCH.id,
    name: 'Jordan Smith',
    email: 'jordan@gracecommunity.church',
    phone: '(555) 123-4567',
    roles: ['Worship Leader', 'Vocals', 'Acoustic Guitar'],
    created_at: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-2',
    church_id: DEMO_CHURCH.id,
    name: 'Alex Rivera',
    email: 'alex@gracecommunity.church',
    phone: '(555) 234-5678',
    roles: ['Vocals', 'Keys', 'Piano'],
    created_at: new Date(Date.now() - 115 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-3',
    church_id: DEMO_CHURCH.id,
    name: 'Sam Johnson',
    email: 'sam@gracecommunity.church',
    phone: '(555) 345-6789',
    roles: ['Electric Guitar', 'Acoustic Guitar'],
    created_at: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-4',
    church_id: DEMO_CHURCH.id,
    name: 'Casey Williams',
    email: 'casey@gracecommunity.church',
    phone: '(555) 456-7890',
    roles: ['Bass'],
    created_at: new Date(Date.now() - 105 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-5',
    church_id: DEMO_CHURCH.id,
    name: 'Morgan Lee',
    email: 'morgan@gracecommunity.church',
    phone: '(555) 567-8901',
    roles: ['Drums', 'Cajon'],
    created_at: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-6',
    church_id: DEMO_CHURCH.id,
    name: 'Taylor Brown',
    email: 'taylor@gracecommunity.church',
    phone: '(555) 678-9012',
    roles: ['Vocals', 'Background Vocals'],
    created_at: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-7',
    church_id: DEMO_CHURCH.id,
    name: 'Jamie Davis',
    email: 'jamie@gracecommunity.church',
    phone: '(555) 789-0123',
    roles: ['Sound Tech', 'Media'],
    created_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tm-8',
    church_id: DEMO_CHURCH.id,
    name: 'Riley Thompson',
    email: 'riley@gracecommunity.church',
    phone: '(555) 890-1234',
    roles: ['Vocals', 'Keys'],
    created_at: new Date(Date.now() - 85 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Helper to get dates relative to today
const getDate = (daysOffset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + daysOffset);
  return date.toISOString().split('T')[0];
};

// Demo Services
export const DEMO_SERVICES: Service[] = [
  {
    id: 'svc-1',
    church_id: DEMO_CHURCH.id,
    title: 'Sunday Morning Worship',
    date: getDate(-14), // 2 weeks ago
    time: '10:00',
    status: 'completed',
    notes: 'Great service! Guest pastor from New York.',
    created_at: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'svc-2',
    church_id: DEMO_CHURCH.id,
    title: 'Sunday Morning Worship',
    date: getDate(-7), // Last week
    time: '10:00',
    status: 'completed',
    notes: 'Communion Sunday. Extended worship time.',
    created_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'svc-3',
    church_id: DEMO_CHURCH.id,
    title: 'Sunday Morning Worship',
    date: getDate(0), // This Sunday
    time: '10:00',
    status: 'finalized',
    notes: 'Baptism service. Need extra setup time.',
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'svc-4',
    church_id: DEMO_CHURCH.id,
    title: 'Sunday Morning Worship',
    date: getDate(7), // Next Sunday
    time: '10:00',
    status: 'draft',
    notes: '',
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Demo Service Items
export const DEMO_SERVICE_ITEMS: ServiceItem[] = [
  // Service 1 (2 weeks ago)
  { id: 'si-1-1', service_id: 'svc-1', type: 'song', position: 0, title: 'Amazing Grace (My Chains Are Gone)', song_id: 'song-1', notes: '', duration_minutes: 5, key: 'G' },
  { id: 'si-1-2', service_id: 'svc-1', type: 'song', position: 1, title: '10,000 Reasons', song_id: 'song-2', notes: '', duration_minutes: 5, key: 'E' },
  { id: 'si-1-3', service_id: 'svc-1', type: 'segment', position: 2, title: 'Welcome & Announcements', song_id: null, notes: 'Welcome guests, highlight small groups', duration_minutes: 5, key: null },
  { id: 'si-1-4', service_id: 'svc-1', type: 'song', position: 3, title: 'How Great Is Our God', song_id: 'song-3', notes: '', duration_minutes: 5, key: 'C' },
  { id: 'si-1-5', service_id: 'svc-1', type: 'segment', position: 4, title: 'Sermon', song_id: null, notes: 'Guest pastor', duration_minutes: 35, key: null },
  { id: 'si-1-6', service_id: 'svc-1', type: 'song', position: 5, title: 'Good Good Father', song_id: 'song-4', notes: 'Response song', duration_minutes: 5, key: 'A' },

  // Service 2 (last week)
  { id: 'si-2-1', service_id: 'svc-2', type: 'song', position: 0, title: 'What A Beautiful Name', song_id: 'song-5', notes: '', duration_minutes: 5, key: 'D' },
  { id: 'si-2-2', service_id: 'svc-2', type: 'song', position: 1, title: 'Amazing Grace (My Chains Are Gone)', song_id: 'song-1', notes: '', duration_minutes: 5, key: 'G' },
  { id: 'si-2-3', service_id: 'svc-2', type: 'segment', position: 2, title: 'Welcome & Announcements', song_id: null, notes: '', duration_minutes: 5, key: null },
  { id: 'si-2-4', service_id: 'svc-2', type: 'segment', position: 3, title: 'Communion', song_id: null, notes: '', duration_minutes: 10, key: null },
  { id: 'si-2-5', service_id: 'svc-2', type: 'song', position: 4, title: 'Oceans', song_id: 'song-6', notes: 'During communion', duration_minutes: 6, key: 'D' },
  { id: 'si-2-6', service_id: 'svc-2', type: 'segment', position: 5, title: 'Sermon', song_id: null, notes: 'Continuing series in John', duration_minutes: 35, key: null },
  { id: 'si-2-7', service_id: 'svc-2', type: 'song', position: 6, title: 'Build My Life', song_id: 'song-7', notes: 'Response', duration_minutes: 5, key: 'G' },

  // Service 3 (this Sunday)
  { id: 'si-3-1', service_id: 'svc-3', type: 'song', position: 0, title: 'Reckless Love', song_id: 'song-8', notes: 'Opener', duration_minutes: 5, key: 'E' },
  { id: 'si-3-2', service_id: 'svc-3', type: 'song', position: 1, title: 'Way Maker', song_id: 'song-9', notes: '', duration_minutes: 6, key: 'B' },
  { id: 'si-3-3', service_id: 'svc-3', type: 'segment', position: 2, title: 'Welcome & Baptism Intro', song_id: null, notes: '3 baptisms today!', duration_minutes: 5, key: null },
  { id: 'si-3-4', service_id: 'svc-3', type: 'segment', position: 3, title: 'Baptisms', song_id: null, notes: 'Play "Amazing Grace" softly during', duration_minutes: 15, key: null },
  { id: 'si-3-5', service_id: 'svc-3', type: 'song', position: 4, title: 'Amazing Grace (My Chains Are Gone)', song_id: 'song-1', notes: 'Full band after baptisms', duration_minutes: 5, key: 'G' },
  { id: 'si-3-6', service_id: 'svc-3', type: 'segment', position: 5, title: 'Sermon', song_id: null, notes: '', duration_minutes: 30, key: null },
  { id: 'si-3-7', service_id: 'svc-3', type: 'song', position: 6, title: 'Great Are You Lord', song_id: 'song-10', notes: 'Response', duration_minutes: 5, key: 'G' },

  // Service 4 (next Sunday - draft)
  { id: 'si-4-1', service_id: 'svc-4', type: 'song', position: 0, title: 'King of My Heart', song_id: 'song-11', notes: '', duration_minutes: 5, key: 'A' },
  { id: 'si-4-2', service_id: 'svc-4', type: 'song', position: 1, title: 'Who You Say I Am', song_id: 'song-12', notes: '', duration_minutes: 5, key: 'G' },
  { id: 'si-4-3', service_id: 'svc-4', type: 'segment', position: 2, title: 'Welcome & Announcements', song_id: null, notes: '', duration_minutes: 5, key: null },
  { id: 'si-4-4', service_id: 'svc-4', type: 'segment', position: 3, title: 'Sermon', song_id: null, notes: '', duration_minutes: 35, key: null },
];

// Demo Service Assignments
export const DEMO_ASSIGNMENTS: ServiceAssignment[] = [
  // Service 1 assignments
  { id: 'asgn-1-1', service_id: 'svc-1', team_member_id: 'tm-1', role: 'Worship Leader', status: 'confirmed' },
  { id: 'asgn-1-2', service_id: 'svc-1', team_member_id: 'tm-2', role: 'Keys', status: 'confirmed' },
  { id: 'asgn-1-3', service_id: 'svc-1', team_member_id: 'tm-3', role: 'Electric Guitar', status: 'confirmed' },
  { id: 'asgn-1-4', service_id: 'svc-1', team_member_id: 'tm-4', role: 'Bass', status: 'confirmed' },
  { id: 'asgn-1-5', service_id: 'svc-1', team_member_id: 'tm-5', role: 'Drums', status: 'declined' },
  { id: 'asgn-1-6', service_id: 'svc-1', team_member_id: 'tm-7', role: 'Sound Tech', status: 'confirmed' },

  // Service 2 assignments
  { id: 'asgn-2-1', service_id: 'svc-2', team_member_id: 'tm-1', role: 'Worship Leader', status: 'confirmed' },
  { id: 'asgn-2-2', service_id: 'svc-2', team_member_id: 'tm-2', role: 'Keys', status: 'confirmed' },
  { id: 'asgn-2-3', service_id: 'svc-2', team_member_id: 'tm-4', role: 'Bass', status: 'confirmed' },
  { id: 'asgn-2-4', service_id: 'svc-2', team_member_id: 'tm-5', role: 'Drums', status: 'confirmed' },
  { id: 'asgn-2-5', service_id: 'svc-2', team_member_id: 'tm-6', role: 'Background Vocals', status: 'confirmed' },
  { id: 'asgn-2-6', service_id: 'svc-2', team_member_id: 'tm-7', role: 'Sound Tech', status: 'confirmed' },

  // Service 3 assignments (this Sunday)
  { id: 'asgn-3-1', service_id: 'svc-3', team_member_id: 'tm-1', role: 'Worship Leader', status: 'confirmed' },
  { id: 'asgn-3-2', service_id: 'svc-3', team_member_id: 'tm-2', role: 'Keys', status: 'confirmed' },
  { id: 'asgn-3-3', service_id: 'svc-3', team_member_id: 'tm-3', role: 'Electric Guitar', status: 'pending' },
  { id: 'asgn-3-4', service_id: 'svc-3', team_member_id: 'tm-4', role: 'Bass', status: 'confirmed' },
  { id: 'asgn-3-5', service_id: 'svc-3', team_member_id: 'tm-5', role: 'Drums', status: 'confirmed' },
  { id: 'asgn-3-6', service_id: 'svc-3', team_member_id: 'tm-6', role: 'Background Vocals', status: 'pending' },
  { id: 'asgn-3-7', service_id: 'svc-3', team_member_id: 'tm-7', role: 'Sound Tech', status: 'confirmed' },

  // Service 4 assignments (next Sunday - pending)
  { id: 'asgn-4-1', service_id: 'svc-4', team_member_id: 'tm-1', role: 'Worship Leader', status: 'pending' },
  { id: 'asgn-4-2', service_id: 'svc-4', team_member_id: 'tm-8', role: 'Keys', status: 'pending' },
  { id: 'asgn-4-3', service_id: 'svc-4', team_member_id: 'tm-3', role: 'Acoustic Guitar', status: 'pending' },
  { id: 'asgn-4-4', service_id: 'svc-4', team_member_id: 'tm-4', role: 'Bass', status: 'pending' },
  { id: 'asgn-4-5', service_id: 'svc-4', team_member_id: 'tm-5', role: 'Cajon', status: 'pending' },
];

// Demo Song Usage (for rotation tracking)
export const DEMO_SONG_USAGE: SongUsage[] = [
  // Service 1 songs
  { id: 'usage-1-1', church_id: DEMO_CHURCH.id, service_id: 'svc-1', song_id: 'song-1', date: getDate(-14) },
  { id: 'usage-1-2', church_id: DEMO_CHURCH.id, service_id: 'svc-1', song_id: 'song-2', date: getDate(-14) },
  { id: 'usage-1-3', church_id: DEMO_CHURCH.id, service_id: 'svc-1', song_id: 'song-3', date: getDate(-14) },
  { id: 'usage-1-4', church_id: DEMO_CHURCH.id, service_id: 'svc-1', song_id: 'song-4', date: getDate(-14) },

  // Service 2 songs
  { id: 'usage-2-1', church_id: DEMO_CHURCH.id, service_id: 'svc-2', song_id: 'song-5', date: getDate(-7) },
  { id: 'usage-2-2', church_id: DEMO_CHURCH.id, service_id: 'svc-2', song_id: 'song-1', date: getDate(-7) },
  { id: 'usage-2-3', church_id: DEMO_CHURCH.id, service_id: 'svc-2', song_id: 'song-6', date: getDate(-7) },
  { id: 'usage-2-4', church_id: DEMO_CHURCH.id, service_id: 'svc-2', song_id: 'song-7', date: getDate(-7) },

  // Service 3 songs (finalized but not completed)
  { id: 'usage-3-1', church_id: DEMO_CHURCH.id, service_id: 'svc-3', song_id: 'song-8', date: getDate(0) },
  { id: 'usage-3-2', church_id: DEMO_CHURCH.id, service_id: 'svc-3', song_id: 'song-9', date: getDate(0) },
  { id: 'usage-3-3', church_id: DEMO_CHURCH.id, service_id: 'svc-3', song_id: 'song-1', date: getDate(0) },
  { id: 'usage-3-4', church_id: DEMO_CHURCH.id, service_id: 'svc-3', song_id: 'song-10', date: getDate(0) },
];

// Demo Templates
export const DEMO_TEMPLATES: ServiceTemplate[] = [
  {
    id: 'tpl-1',
    church_id: DEMO_CHURCH.id,
    title: 'Sunday Morning Worship',
    time: '10:00',
    day_of_week: 0, // Sunday
    roles: ['Worship Leader', 'Keys', 'Acoustic Guitar', 'Bass', 'Drums', 'Background Vocals', 'Sound Tech'],
    items: [
      { type: 'song', position: 0, title: '', song_id: null, notes: 'Opening song', duration_minutes: 5, key: null },
      { type: 'song', position: 1, title: '', song_id: null, notes: 'Second song', duration_minutes: 5, key: null },
      { type: 'segment', position: 2, title: 'Welcome & Announcements', song_id: null, notes: '', duration_minutes: 5, key: null },
      { type: 'segment', position: 3, title: 'Sermon', song_id: null, notes: '', duration_minutes: 35, key: null },
      { type: 'song', position: 4, title: '', song_id: null, notes: 'Response song', duration_minutes: 5, key: null },
    ],
    notes: 'Standard Sunday morning order of service',
    created_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'tpl-2',
    church_id: DEMO_CHURCH.id,
    title: 'Sunday Evening Service',
    time: '18:00',
    day_of_week: 0, // Sunday
    roles: ['Worship Leader', 'Keys', 'Acoustic Guitar'],
    items: [
      { type: 'song', position: 0, title: '', song_id: null, notes: '', duration_minutes: 5, key: null },
      { type: 'segment', position: 1, title: 'Welcome', song_id: null, notes: '', duration_minutes: 3, key: null },
      { type: 'song', position: 2, title: '', song_id: null, notes: '', duration_minutes: 5, key: null },
      { type: 'segment', position: 3, title: 'Teaching', song_id: null, notes: '', duration_minutes: 25, key: null },
      { type: 'segment', position: 4, title: 'Prayer & Ministry Time', song_id: null, notes: '', duration_minutes: 15, key: null },
    ],
    notes: 'More intimate evening service format',
    created_at: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

// Demo Chat Messages
const tm1 = DEMO_TEAM_MEMBERS.find(m => m.id === 'tm-1')!;
const tm2 = DEMO_TEAM_MEMBERS.find(m => m.id === 'tm-2')!;
const tm3 = DEMO_TEAM_MEMBERS.find(m => m.id === 'tm-3')!;
const tm5 = DEMO_TEAM_MEMBERS.find(m => m.id === 'tm-5')!;

export const DEMO_CHAT_MESSAGES: ChatMessagePopulated[] = [
  {
    id: 'chat-1',
    church_id: DEMO_CHURCH.id,
    user_id: tm1.id,
    content: 'Hey team! Just uploaded chord charts for this Sunday. Please take a look and let me know if you need any changes.',
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    user: { id: tm1.id, name: tm1.name, email: tm1.email },
  },
  {
    id: 'chat-2',
    church_id: DEMO_CHURCH.id,
    user_id: tm2.id,
    content: 'Thanks Jordan! I noticed we\'re doing Way Maker in B - should I transpose to A for easier playing on keys?',
    created_at: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours ago
    user: { id: tm2.id, name: tm2.name, email: tm2.email },
  },
  {
    id: 'chat-3',
    church_id: DEMO_CHURCH.id,
    user_id: tm1.id,
    content: 'Good call! Let\'s do it in A then. I\'ll update the setlist.',
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(), // 1 hour ago
    user: { id: tm1.id, name: tm1.name, email: tm1.email },
  },
  {
    id: 'chat-4',
    church_id: DEMO_CHURCH.id,
    user_id: tm5.id,
    content: 'Reminder: rehearsal is Thursday at 7pm. Can everyone make it?',
    created_at: new Date(Date.now() - 0.5 * 60 * 60 * 1000).toISOString(), // 30 min ago
    user: { id: tm5.id, name: tm5.name, email: tm5.email },
  },
  {
    id: 'chat-5',
    church_id: DEMO_CHURCH.id,
    user_id: tm3.id,
    content: 'I\'ll be there! Should I bring my pedalboard or go straight to amp?',
    created_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(), // 15 min ago
    user: { id: tm3.id, name: tm3.name, email: tm3.email },
  },
];

// Helper to get all demo data at once
export function getInitialDemoData() {
  return {
    church: DEMO_CHURCH,
    user: DEMO_USER,
    songs: [...DEMO_SONGS],
    teamMembers: [...DEMO_TEAM_MEMBERS],
    services: [...DEMO_SERVICES],
    serviceItems: [...DEMO_SERVICE_ITEMS],
    assignments: [...DEMO_ASSIGNMENTS],
    songUsage: [...DEMO_SONG_USAGE],
    templates: [...DEMO_TEMPLATES],
    chatMessages: [...DEMO_CHAT_MESSAGES],
  };
}
