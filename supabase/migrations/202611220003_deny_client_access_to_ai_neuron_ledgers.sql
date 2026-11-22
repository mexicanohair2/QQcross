create policy "Deny client access to QQCross AI neuron usage"
on public.qqcross_ai_neuron_usage
for all
to anon, authenticated
using (false)
with check (false);

create policy "Deny client access to QQCross AI neuron reservations"
on public.qqcross_ai_neuron_reservations
for all
to anon, authenticated
using (false)
with check (false);
