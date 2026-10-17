-- Teste de extrato, relatórios e dashboard direto no banco. Não deixa nada gravado:
-- ao final levanta uma exceção de propósito, que desfaz TUDO.
--   * Se passar:  aparece um "erro" começando com  OK: ...
--   * Se falhar:  aparece a mensagem do cenário que falhou.
-- Usa datas de JANEIRO DE 2030 para não se misturar com seus dados reais.
do $$
declare
  u uuid := '74a9bd78-fcb3-4274-a2f4-27322939be7f';  -- UID do seu usuário de teste
  c1 public.conta; c2 public.conta;
  r jsonb; j jsonb; d1 uuid; d2 uuid; d3 uuid; d4 uuid; d5 uuid; d6 uuid;
  saldo_antes numeric; contas_antes int; n int;
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', u, 'role', 'authenticated')::text, true);

  select coalesce(sum(saldo_disponivel), 0), count(*) into saldo_antes, contas_antes
    from public.conta where deleted_at is null;

  -- ---------- dados de teste ----------
  c1 := public.criar_conta('TESTE Rel A', 'corrente', 1000);
  c2 := public.criar_conta('TESTE Rel B', 'caixa', 0);

  perform public.criar_receita(c1.id, 'Salário', 1200, '2030-01-10', 'Salário');
  perform public.criar_receita(c1.id, 'Freela', 300, '2030-01-12', 'Serviços');
  perform public.criar_receita(c2.id, 'Venda', 100, '2030-01-20', 'Vendas');
  perform public.criar_receita(c1.id, 'Fora do período', 999, '2030-03-01', 'Vendas');

  r := public.criar_despesa(c1.id, 'Mercado', 240, '2030-01-05', 'Alimentação');
  d1 := (r->'despesa'->>'id')::uuid;  perform public.pagar_despesa(d1);
  r := public.criar_despesa(c1.id, 'Aluguel', 500, '2030-01-06', 'Moradia');
  d2 := (r->'despesa'->>'id')::uuid;  perform public.pagar_despesa(d2);
  -- pagamento não pode ser futuro; ajustamos a data direto (só neste teste, depois desfeito)
  update public.despesa set data_pagamento = '2030-01-11' where id = d1;
  update public.despesa set data_pagamento = '2030-01-13' where id = d2;

  r := public.criar_despesa(c1.id, 'Água', 150, '2030-01-15', 'Contas');     d3 := (r->'despesa'->>'id')::uuid;
  r := public.criar_despesa(c1.id, 'Internet', 80, '2030-01-10', 'Contas');  d4 := (r->'despesa'->>'id')::uuid;
  r := public.criar_despesa(c1.id, 'Luz', 90, '2030-01-18', 'Contas');       d5 := (r->'despesa'->>'id')::uuid;
  r := public.criar_despesa(c1.id, 'Seguro', 70, '2030-03-01', 'Contas');    d6 := (r->'despesa'->>'id')::uuid;

  -- ---------- EXTRATO ----------
  j := public.extrato('2030-01-01', '2030-01-31');
  assert (j->'totais'->>'entradas')::numeric = 1600, '1a: entradas deveriam ser 1600, deu ' || (j->'totais'->>'entradas');
  assert (j->'totais'->>'saidas')::numeric = 740, '1b: saídas = só pagas (740), deu ' || (j->'totais'->>'saidas');
  assert (j->'totais'->>'saldo_periodo')::numeric = 860, '1c: saldo do período deveria ser 860';
  assert (j->'totais'->>'quantidade')::int = 5, '1d: deveriam ser 5 lançamentos';
  assert j->'itens'->0->>'descricao' = 'Salário' and j->'itens'->4->>'descricao' = 'Venda',
         '1e: ordem cronológica errada (esperado Salário ... Venda)';

  j := public.extrato('2030-01-01', '2030-01-31', c2.id);
  assert (j->'totais'->>'entradas')::numeric = 100 and (j->'totais'->>'quantidade')::int = 1, '2: filtro por conta falhou';

  j := public.extrato('2030-01-01', '2030-01-31', null, 'despesas');
  assert (j->'totais'->>'saidas')::numeric = 740 and (j->'totais'->>'entradas')::numeric = 0
         and (j->'totais'->>'quantidade')::int = 2, '3: filtro "despesas" falhou';

  j := public.extrato('2030-01-01', '2030-01-31', null, 'todos', 'categoria');
  assert j->'itens'->0->>'descricao' = 'Mercado', '4: ordem por categoria deveria começar por Alimentação (Mercado)';

  j := public.extrato('2030-01-01', '2030-01-31', null, 'todos', 'data', 2, 1);
  assert jsonb_array_length(j->'itens') = 2 and j->'itens'->0->>'descricao' = 'Mercado'
         and (j->'totais'->>'quantidade')::int = 5, '5: paginação (limit 2, offset 1) falhou';

  perform public.excluir_despesa(d1);
  j := public.extrato('2030-01-01', '2030-01-31');
  assert (j->'totais'->>'quantidade')::int = 4 and (j->'totais'->>'saidas')::numeric = 500,
         '6a: despesa paga excluída não deveria aparecer no extrato';
  perform public.restaurar_despesa(d1);
  j := public.extrato('2030-01-01', '2030-01-31');
  assert (j->'totais'->>'quantidade')::int = 5 and (j->'totais'->>'saidas')::numeric = 740,
         '6b: despesa restaurada deveria voltar ao extrato';

  -- ---------- RELATÓRIO POR CATEGORIA ----------
  j := public.relatorio_categorias('receitas', '2030-01-01', '2030-01-31');
  assert (j->>'total')::numeric = 1600 and (j->>'quantidade')::int = 3, '7a: total de receitas';
  assert j->'categorias'->0->>'categoria' = 'Salário' and (j->'categorias'->0->>'percentual')::numeric = 75.00,
         '7b: Salário deveria ser 75%';
  assert (select sum((c->>'percentual')::numeric) from jsonb_array_elements(j->'categorias') c) = 100,
         '7c: percentuais deveriam somar 100';

  j := public.relatorio_categorias('despesas', '2030-01-01', '2030-01-31');
  assert (j->>'total')::numeric = 740 and (j->>'quantidade')::int = 2, '8a: despesas = só pagas (740)';
  assert j->'categorias'->0->>'categoria' = 'Moradia', '8b: maior categoria deveria ser Moradia';
  assert (j->'a_pagar'->>'total')::numeric = 320 and (j->'a_pagar'->>'quantidade')::int = 3,
         '8c: a pagar em janeiro deveria ser 320 (3 pendentes), deu ' || (j->'a_pagar'->>'total');

  -- ---------- DASHBOARD (hoje = 2030-01-15) ----------
  j := public.dashboard('2030-01-15');
  assert (j->'entradas_30d'->>'total')::numeric = 1500 and (j->'entradas_30d'->>'quantidade')::int = 2,
         '9a: entradas 30d = 1500 (a receita de 20/01 ainda não aconteceu), deu ' || (j->'entradas_30d'->>'total');
  assert (j->'saidas_30d'->>'total')::numeric = 740 and (j->'saidas_30d'->>'quantidade')::int = 2, '9b: saídas 30d';
  assert (j->'mes'->>'receitas')::numeric = 1600 and (j->'mes'->>'despesas')::numeric = 740, '9c: totais do mês';
  assert (j->>'saldo_total')::numeric - saldo_antes = 2859,
         '9d: saldo total deveria subir 2859, subiu ' || ((j->>'saldo_total')::numeric - saldo_antes);
  assert (j->>'contas_ativas')::int - contas_antes = 2, '9e: deveriam existir 2 contas ativas a mais';
  assert (j->'a_pagar'->>'total')::numeric >= 390 and (j->'a_pagar'->>'quantidade')::int >= 4, '9f: a pagar';
  assert (j->'proximo_vencimento'->>'id')::uuid = d3, '9g: próximo vencimento deveria ser a Água (15/01)';
  assert j->'movimentacoes_recentes'->0->>'descricao' = 'Aluguel', '9h: última movimentação deveria ser o Aluguel (13/01)';

  select count(*) into n from jsonb_array_elements(j->'alertas') a
   where (a->>'id' = d3::text and a->>'situacao' = 'hoje')
      or (a->>'id' = d4::text and a->>'situacao' = 'vencida')
      or (a->>'id' = d5::text and a->>'situacao' = 'proxima');
  assert n = 3, '10a: alertas deveriam trazer Água (hoje), Internet (vencida) e Luz (próxima), trouxe ' || n;
  select count(*) into n from jsonb_array_elements(j->'alertas') a where a->>'id' = d6::text;
  assert n = 0, '10b: o Seguro (vence só em março) não deveria virar alerta';

  raise exception 'OK: todos os cenários de extrato, relatórios e dashboard passaram (alterações revertidas de propósito)';
end $$;
