-- Executar no SQL Editor após a migration, preferencialmente em projeto de teste.
-- Fixtures sintéticas dentro de transação: ROLLBACK remove todos os dados ao final.
-- Em caso de erro, execute ROLLBACK antes de repetir. Nenhum UID real é necessário.
begin;

select set_config('krab.teste_usuario_a', gen_random_uuid()::text, true);
select set_config('krab.teste_usuario_b', gen_random_uuid()::text, true);
select set_config('krab.teste_conta_a', gen_random_uuid()::text, true);
select set_config('krab.teste_conta_b', gen_random_uuid()::text, true);

insert into auth.users (id) values
  (current_setting('krab.teste_usuario_a')::uuid),
  (current_setting('krab.teste_usuario_b')::uuid);
insert into public.conta (id, user_id, nome, saldo_disponivel) values
  (current_setting('krab.teste_conta_a')::uuid, current_setting('krab.teste_usuario_a')::uuid, 'TESTE resumo A', 9000),
  (current_setting('krab.teste_conta_b')::uuid, current_setting('krab.teste_usuario_b')::uuid, 'TESTE resumo B', 5000);

-- Primeiro validamos o usuário sem lançamentos, com RLS realmente habilitada:
-- apenas definir o JWT mantendo a role postgres não comprovaria isolamento.
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('krab.teste_usuario_a'), 'role', 'authenticated')::text, true);
do $$ begin
  assert public.resumo_desenvolvimento() = '{"entradas":0,"saidas":0,"saldo":0}'::jsonb, 'Conta com saldo inicial não deve entrar na soma';
  assert not has_function_privilege('anon', 'public.resumo_desenvolvimento()', 'execute'), 'Anon não pode executar';
end $$;
reset role;

-- Datas fora do período atual também entram. Inserções diretas são apenas
-- fixtures de teste: não executam os fluxos financeiros e serão desfeitas.
insert into public.receita (user_id, conta_id, descricao, valor, data_recebimento, categoria, deleted_at) values
  (current_setting('krab.teste_usuario_a')::uuid, current_setting('krab.teste_conta_a')::uuid, 'Receita ativa', 1240.10, '2001-01-01', 'Teste', null),
  (current_setting('krab.teste_usuario_a')::uuid, current_setting('krab.teste_conta_a')::uuid, 'Receita excluída', 9999, '2001-01-01', 'Teste', now()),
  (current_setting('krab.teste_usuario_b')::uuid, current_setting('krab.teste_conta_b')::uuid, 'Outro usuário', 10, '2001-01-01', 'Teste', null);
insert into public.despesa (user_id, conta_id, descricao, valor, data_vencimento, categoria, status, data_pagamento, valor_pago, deleted_at) values
  (current_setting('krab.teste_usuario_a')::uuid, current_setting('krab.teste_conta_a')::uuid, 'Pendente', 700.05, '2099-01-01', 'Teste', 'pendente', null, null, null),
  (current_setting('krab.teste_usuario_a')::uuid, current_setting('krab.teste_conta_a')::uuid, 'Paga', 60.05, '2001-01-01', 'Teste', 'paga', '2001-01-01', 60.05, null),
  (current_setting('krab.teste_usuario_a')::uuid, current_setting('krab.teste_conta_a')::uuid, 'Excluída', 9999, '2001-01-01', 'Teste', 'pendente', null, null, now()),
  (current_setting('krab.teste_usuario_b')::uuid, current_setting('krab.teste_conta_b')::uuid, 'Outro usuário', 20, '2001-01-01', 'Teste', 'pendente', null, null, null);

set local role authenticated;
do $$ begin
  assert public.resumo_desenvolvimento() = '{"entradas":1240.10,"saidas":760.10,"saldo":480}'::jsonb, 'Somar ativas, incluindo pendentes e pagas, sem período ou outros usuários';
  assert (select saldo_disponivel from public.conta where id = current_setting('krab.teste_conta_a')::uuid) = 9000, 'Leitura não altera saldo real';
  assert (select count(*) from public.despesa where status = 'pendente' and deleted_at is null) = 1, 'Leitura não altera status';
end $$;
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('krab.teste_usuario_b'), 'role', 'authenticated')::text, true);
do $$ begin
  assert public.resumo_desenvolvimento() = '{"entradas":10,"saidas":20,"saldo":-10}'::jsonb, 'RLS isola o segundo usuário e permite saldo negativo';
end $$;
reset role;

-- Mais de 1000 receitas comprovam que a soma não depende de limite de API.
insert into public.receita (user_id, conta_id, descricao, valor, data_recebimento, categoria)
select current_setting('krab.teste_usuario_a')::uuid, current_setting('krab.teste_conta_a')::uuid,
       'Centavo ' || n, 0.01, '2001-01-01'::date, 'Teste'
from generate_series(1, 1001) n;
set local role authenticated;
select set_config('request.jwt.claims', json_build_object(
  'sub', current_setting('krab.teste_usuario_a'), 'role', 'authenticated')::text, true);
do $$ begin
  assert public.resumo_desenvolvimento() = '{"entradas":1250.11,"saidas":760.10,"saldo":490.01}'::jsonb, 'Soma decimal exata sem paginação';
end $$;
reset role;
rollback;
-- Concluído sem erro: todos os cenários passaram, nenhuma fixture persistiu.
