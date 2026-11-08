-- These ledgers are internal-only. Client roles receive no table grants;
-- explicit false policies make the intended deny-by-default behavior clear.
CREATE POLICY "deny client access to level reward claims"
ON private.qqcross_level_reward_claims
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY "deny client access to AI usage ledger"
ON public.qqcross_ai_usage
FOR ALL
TO anon, authenticated
USING (false)
WITH CHECK (false);
