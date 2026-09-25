/*
# Revoke EXECUTE on handle_new_user from PUBLIC

The previous REVOKE from anon/authenticated didn't fully suppress the advisor warning
because the function still has EXECUTE granted to PUBLIC by default.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;