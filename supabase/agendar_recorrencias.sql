-- OPCIONAL: gera as ocorrências sozinho, todo dia, sem depender de alguém abrir o app.
-- 1) Ative a extensão: painel do Supabase -> Database -> Extensions -> pg_cron (Enable).
-- 2) Rode este SQL UMA vez. 03:10 UTC = 00:10 no horário de São Paulo.
select cron.schedule(
  'krab-gerar-recorrencias',
  '10 3 * * *',
  $$select public.gerar_ocorrencias_todas()$$
);

-- Para conferir:   select jobname, schedule, active from cron.job;
-- Para remover:    select cron.unschedule('krab-gerar-recorrencias');
-- Sem o agendador, o app pode chamar POST /despesas-recorrentes/geracao ao abrir (é idempotente).
