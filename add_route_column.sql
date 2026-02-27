-- Run this in your Supabase SQL Editor to enable remote navigation!
-- This allows the admin scoreboard to force the public screen to switch pages.

ALTER TABLE scoreboard_settings 
ADD COLUMN IF NOT EXISTS force_route TEXT DEFAULT '/scoreboard';
