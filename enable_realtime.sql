-- Run this in your Supabase SQL Editor to enable instant WebSocket syncing
-- for the public scoreboard.

-- Enable Realtime for the 'teams' table
ALTER PUBLICATION supabase_realtime ADD TABLE teams;

-- Enable Realtime for the 'scoreboard_settings' table
ALTER PUBLICATION supabase_realtime ADD TABLE scoreboard_settings;
