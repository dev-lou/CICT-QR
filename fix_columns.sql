-- Run this in your Supabase SQL Editor to fix the sync bug!
-- This adds the missing columns that your new buttons are trying to save.

ALTER TABLE scoreboard_settings 
ADD COLUMN IF NOT EXISTS hide_rank_3 BOOLEAN DEFAULT FALSE, 
ADD COLUMN IF NOT EXISTS hide_rank_4 BOOLEAN DEFAULT FALSE;
