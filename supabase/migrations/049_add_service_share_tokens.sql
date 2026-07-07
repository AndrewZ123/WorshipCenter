-- Migration: Add share tokens for public service sharing
-- Enables users to share a read-only link to a service with anyone

ALTER TABLE services ADD COLUMN IF NOT EXISTS share_token UUID UNIQUE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_services_share_token ON services(share_token) WHERE share_token IS NOT NULL;
