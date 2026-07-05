-- Lucky Jambo - allow new AI feature types in ai_chat_logs
--
-- Adding two new AI-powered features (post-match chess recap and
-- personalized recommendations) that reuse the same rate-limiting /
-- audit log table as the support chat and admin analyst. Both need
-- their own assistant_type value.

alter table ai_chat_logs drop constraint if exists ai_chat_logs_assistant_type_check;

alter table ai_chat_logs add constraint ai_chat_logs_assistant_type_check
  check (assistant_type in ('support', 'admin_analyst', 'game_recap', 'recommendations'));
