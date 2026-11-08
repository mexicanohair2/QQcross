-- Defense in depth: the level reward claim ledger is private and is accessed
-- only by trusted SECURITY DEFINER routines owned by postgres.
-- No client policies are needed; direct client access remains denied.
ALTER TABLE private.qqcross_level_reward_claims
  ENABLE ROW LEVEL SECURITY;
