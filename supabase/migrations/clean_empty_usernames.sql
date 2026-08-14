-- Migration: clean_empty_usernames.sql
-- Ensure empty string client_username values are converted to NULL to prevent unique constraint collisions

UPDATE tenants 
SET client_username = NULL 
WHERE client_username = '' OR TRIM(client_username) = '';

UPDATE tenants 
SET client_password = NULL 
WHERE client_password = '' OR TRIM(client_password) = '';
