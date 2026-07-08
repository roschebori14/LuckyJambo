-- Lucky Jambo - allow the admin-only live match-hint AI feature
--
-- Same reason as 046_widen_ai_chat_logs_types.sql: a new AI feature
-- reusing the shared rate-limit/audit log table needs its own
-- assistant_type value.

alter table ai_chat_logs drop constraint if exists ai_chat_logs_assistant_type_check;

alter table ai_chat_logs add constraint ai_chat_logs_assistant_type_check
  check (assistant_type in ('support', 'admin_analyst', 'game_recap', 'recommendations', 'match_hint'));
