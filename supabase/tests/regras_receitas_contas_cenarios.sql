-- Cenários de integração para PostgreSQL/Supabase de TESTE, após todas as migrations.
-- Fixtures sintéticas; rollback ao final. Nunca executar em produção.
-- alteração Pedro: não havia cenário integrado para as novas regras; agora fixtures sintéticas verificam as RPCs dentro de transação revertida.
begin;

-- alteração Pedro: os novos cenários precisavam verificar rejeições sem interromper a sequência; agora um auxiliar temporário exige o erro de negócio esperado.
create function pg_temp.esperar_erro(p_sql text, p_erro text)
returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if sqlerrm = p_erro then return; end if;
    raise;
  end;
  raise exception 'Esperado erro %, mas a operação foi aceita: %', p_erro, p_sql;
end;
$$;

do $$
declare
  u uuid := gen_random_uuid();
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  c public.conta; positiva public.conta; negativa public.conta;
  r public.receita; excluida public.receita;
  d uuid; pendente uuid; j jsonb;
  saldo numeric; eventos bigint;
begin
  insert into auth.users (id) values (u);
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  c := public.criar_conta('TESTE regras');

  -- alteração Pedro: não havia cobertura SQL do limite de recebimento; agora verifica hoje, passado, rejeição futura e preservação de saldo e ledger.
  -- Receita: hoje/passado aceitos, criação/edição futuras rejeitadas sem alterar saldo/ledger.
  r := public.criar_receita(c.id, 'Hoje', 100, hoje, 'Teste');
  assert r.data_recebimento = hoje;
  excluida := public.criar_receita(c.id, 'Passado', 20, hoje - 1, 'Teste');
  assert excluida.data_recebimento = hoje - 1;
  r := public.editar_receita(r.id, p_data => hoje - 1);
  assert r.data_recebimento = hoje - 1;
  r := public.editar_receita(r.id, p_data => hoje);
  assert r.data_recebimento = hoje;
  select saldo_disponivel into saldo from public.conta where id = c.id;
  select count(*) into eventos from public.movimentacao_conta where conta_id = c.id;
  perform pg_temp.esperar_erro(format(
    'select public.criar_receita(%L, %L, 50, %L, %L)', c.id, 'Futura', hoje + 1, 'Teste'),
    'data_recebimento_invalida');
  perform pg_temp.esperar_erro(format(
    'select public.editar_receita(%L, p_valor => 200, p_data => %L)', r.id, hoje + 1),
    'data_recebimento_invalida');
  assert (select saldo_disponivel = saldo from public.conta where id = c.id);
  assert (select count(*) = eventos from public.movimentacao_conta where conta_id = c.id);
  assert (select valor = 100 and data_recebimento = hoje from public.receita where id = r.id);

  -- alteração Pedro: excluir conta permitia saldo não zero; agora os cenários exigem rejeição de saldo positivo, negativo e pendências, com exclusão apenas após zerar.
  -- Conta: saldo positivo/negativo bloqueia; saldo zero com pendência também bloqueia.
  positiva := public.criar_conta('TESTE positiva', 'caixa', 1);
  negativa := public.criar_conta('TESTE negativa', 'caixa', -1);
  perform pg_temp.esperar_erro(format('select public.excluir_conta(%L)', positiva.id), 'conta_com_saldo');
  perform pg_temp.esperar_erro(format('select public.excluir_conta(%L)', negativa.id), 'conta_com_saldo');
  perform public.excluir_receita(excluida.id);
  j := public.criar_despesa(c.id, 'Paga', 100, hoje, 'Teste');
  d := (j->'despesa'->>'id')::uuid;
  perform public.pagar_despesa(d);
  assert (select saldo_disponivel = 0 from public.conta where id = c.id);
  j := public.criar_despesa(c.id, 'Pendente', 10, hoje, 'Teste');
  pendente := (j->'despesa'->>'id')::uuid;
  perform pg_temp.esperar_erro(format('select public.excluir_conta(%L)', c.id), 'conta_com_pendencias');
  perform public.excluir_despesa(pendente);
  c := public.excluir_conta(c.id);
  assert c.deleted_at is not null and c.saldo_disponivel = 0;

  -- alteração Pedro: operações em conta excluída não tinham esta cobertura; agora verifica os bloqueios financeiros e preserva consulta ao histórico e edição textual de receita.
  -- Conta excluída: sem alteração de saldo, sem despesa editada/paga/restaurada.
  select count(*) into eventos from public.movimentacao_conta where conta_id = c.id;
  perform pg_temp.esperar_erro(format('select public.editar_receita(%L, p_valor => 101)', r.id), 'conta_excluida');
  perform pg_temp.esperar_erro(format('select public.restaurar_receita(%L)', excluida.id), 'conta_excluida');
  perform pg_temp.esperar_erro(format('select public.excluir_receita(%L)', r.id), 'conta_excluida');
  perform pg_temp.esperar_erro(format('select public.editar_despesa(%L, p_descricao => %L)', d, 'Outro'), 'conta_excluida');
  perform pg_temp.esperar_erro(format('select public.pagar_despesa(%L)', d), 'conta_excluida');
  perform pg_temp.esperar_erro(format('select public.restaurar_despesa(%L)', pendente), 'conta_excluida');
  perform pg_temp.esperar_erro(format('select public.excluir_despesa(%L)', d), 'conta_excluida');
  -- Alterar apenas o texto de receita não altera financeiramente a conta.
  perform public.editar_receita(r.id, p_descricao => 'Texto corrigido');
  assert (select saldo_disponivel = 0 from public.conta where id = c.id);
  assert (select count(*) = eventos from public.movimentacao_conta where conta_id = c.id);
  assert (select deleted_at is not null from public.receita where id = excluida.id);
  assert (select descricao = 'Paga' from public.despesa where id = d);
  assert (select deleted_at is not null from public.despesa where id = pendente);
  assert (public.movimentacoes(c.id)->>'total')::bigint = eventos;

  -- alteração Pedro: não havia teste de retomada após os novos bloqueios; agora a restauração libera operações válidas e o saldo final deve coincidir com o ledger.
  -- Restaurar a conta libera novamente edição, restauração e pagamento válidos.
  c := public.restaurar_conta(c.id);
  assert c.deleted_at is null;
  perform public.editar_receita(r.id, p_valor => 110);
  perform public.restaurar_receita(excluida.id);
  perform public.editar_despesa(d, p_valor => 105);
  perform public.restaurar_despesa(pendente);
  perform public.editar_despesa(pendente, p_valor => 15);
  perform public.pagar_despesa(pendente);
  assert (select saldo_disponivel = 10 from public.conta where id = c.id);
  assert (select sum(valor) = 10 from public.movimentacao_conta where conta_id = c.id);
end;
$$;

rollback;
