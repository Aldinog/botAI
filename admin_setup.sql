-- Create a settings table for global app configuration
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB
);

-- Initialize maintenance mode as false
INSERT INTO app_settings (key, value) 
VALUES ('maintenance_mode', 'false'::jsonb);
