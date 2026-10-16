-- Migration 002: Add partial_mode boolean flag to reviews table
ALTER TABLE public.reviews
ADD COLUMN IF NOT EXISTS partial_mode BOOLEAN DEFAULT false;
