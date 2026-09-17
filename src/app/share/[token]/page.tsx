import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase';
import type { Service, Church, ServiceItem, Song, ServiceAssignment, TeamMember } from '@/lib/types';
import ShareView from './ShareView';

export function generateStaticParams() {
  return [{ token: 'placeholder' }];
}

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ demo?: string }>;
}

async function fetchShareData(token: string) {
  if (!isSupabaseAdminConfigured()) return null;

  const { data: service } = await supabaseAdmin
    .from('services')
    .select('*')
    .eq('share_token', token)
    .single();

  if (!service) return null;

  const [{ data: church }, { data: items }, { data: assignments }, { data: teamMembers }] = await Promise.all([
    supabaseAdmin.from('churches').select('name').eq('id', service.church_id).single(),
    supabaseAdmin.from('service_items').select('*').eq('service_id', service.id).order('position'),
    supabaseAdmin.from('service_assignments').select('*').eq('service_id', service.id),
    supabaseAdmin.from('team_members').select('*').eq('church_id', service.church_id),
  ]);

  const songIds = [...new Set((items || []).filter(i => i.song_id).map(i => i.song_id!))];
  const songs: Song[] = [];
  if (songIds.length > 0) {
    const { data: songData } = await supabaseAdmin
      .from('songs')
      .select('*')
      .in('id', songIds);
    if (songData) songs.push(...songData);
  }

  return {
    service: service as Service,
    church: church as Pick<Church, 'name'> | null,
    items: (items || []) as ServiceItem[],
    songs,
    assignments: (assignments || []) as ServiceAssignment[],
    teamMembers: (teamMembers || []) as TeamMember[],
  };
}

export default async function SharePage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const sp = await searchParams;

  if (sp.demo === '1' || token.startsWith('demo-')) {
    return <ShareView data={null} isDemo />;
  }

  const data = await fetchShareData(token);

  return <ShareView data={data} />;
}
