/*
# Harden trigger functions — fix search_path and EXECUTE grants

1. Sets explicit search_path on both trigger functions to prevent search_path injection.
2. Revokes EXECUTE from anon and authenticated on handle_new_user (it's a trigger, not meant to be called directly).
3. Sets handle_updated_at to SECURITY INVOKER (no privilege escalation needed).
*/

-- Fix search_path and security on handle_updated_at
ALTER FUNCTION public.handle_updated_at() SECURITY INVOKER;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;

-- Fix search_path on handle_new_user (keep SECURITY DEFINER since it inserts into profiles)
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Revoke direct execution of trigger functions from anon and authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_updated_at() FROM anon, authenticated;