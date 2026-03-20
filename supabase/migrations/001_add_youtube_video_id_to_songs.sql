-- Migration: Add youtube_video_id column to songs table
-- Created: 2025-03-16
-- Description: Adds support for storing YouTube video IDs with songs

ALTER TABLE songs ADD COLUMN IF NOT EXISTS youtube_video_id TEXT;
