import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRequestUser } from '@/lib/auth-middleware';
import { db } from '@/lib/store';
import { validateFile } from '@/lib/validateFile';
import { z } from 'zod';
import type { SongFileType } from '@/lib/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// GET /api/songs/[songId]/files - List all files for a song
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const { songId } = await params;
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const files = await db.songFiles.getBySong(songId, user.church_id);
    return NextResponse.json({ files });
  } catch (error) {
    console.error('[API] Song files GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const FileTypeSchema = z.enum(['chord_chart', 'lyrics', 'lead_sheet', 'audio', 'pdf', 'image', 'other']).catch('other');

// POST /api/songs/[songId]/files - Upload a file for a song
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const { songId } = await params;
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify song belongs to church
    const song = await db.songs.getById(songId, user.church_id);
    if (!song) {
      return NextResponse.json({ error: 'Song not found' }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get('file') as File;
    const typeRaw = formData.get('type') as string | null;
    const isPrimary = formData.get('is_primary') === 'true';
    const arrangementId = formData.get('arrangement_id') as string | null;
    const versionId = formData.get('version_id') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate type
    const type = FileTypeSchema.parse(typeRaw) as SongFileType;

    // Validate file
    const { valid, error: validationError } = await validateFile(file, {
      allowedMimeTypes: ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'],
      maxSize: 10 * 1024 * 1024, // 10MB in bytes
    });
    if (!valid) {
      return NextResponse.json({ error: validationError || 'Invalid file' }, { status: 400 });
    }

    // Upload to Supabase Storage
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const fileExt = file.name.split('.').pop();
    const fileName = `${songId}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storagePath = `song-files/${fileName}`;

    const { error: uploadError } = await adminClient.storage
      .from('songs')
      .upload(storagePath, file, {
        contentType: file.type,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('[API] File upload error:', uploadError);
      return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
    }

    // Get public URL
    const { data: urlData } = adminClient.storage
      .from('songs')
      .getPublicUrl(storagePath);

    // Create file record
    const fileRecord = await db.songFiles.create({
      song_id: songId,
      file_url: urlData.publicUrl,
      file_name: file.name,
      type,
      file_size: file.size,
      mime_type: file.type,
      arrangement_id: arrangementId || null,
      version_id: versionId || null,
      is_primary: isPrimary,
      uploaded_by: user.id,
    });

    // If setting as primary, unset others
    if (isPrimary) {
      await db.songFiles.setPrimary(fileRecord.id, songId, user.church_id);
    }

    // Log to song history
    await adminClient.from('song_history').insert({
      song_id: songId,
      action: 'updated',
      changed_by: user.id,
      new_data: { action: 'file_uploaded', file_name: file.name, type },
      church_id: user.church_id,
    });

    return NextResponse.json({ file: fileRecord });
  } catch (error) {
    console.error('[API] Song file POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

const DeleteFileSchema = z.object({
  fileId: z.string().uuid('Invalid file ID'),
});

// DELETE /api/songs/[songId]/files - Delete a file
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ songId: string }> }
) {
  try {
    const { songId } = await params;
    const user = await getRequestUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = DeleteFileSchema.parse(await req.json());

    const success = await db.songFiles.delete(body.fileId, user.church_id);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 400 });
    }
    console.error('[API] Song file DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}