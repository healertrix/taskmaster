-- Diagnostic only — changes nothing. Confirms whether
-- 20260808130000_fix_handle_new_comment_mentions_cast.sql actually
-- applied. Look for "mention_array->i->>'id'" in the output (fixed) vs
-- "mention_array->i)::UUID" alone with no ->>'id' (still broken).
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_comment';
