-- Teste das movimentações direto no banco. Não deixa nada gravado: ao final levanta uma exceção
-- de propósito, que desfaz TUDO.
--   * Se passar:  aparece um "erro" começando com  OK: ...
--   * Se falhar:  aparece a mensagem do cenário que falhou.
do $$
declare
  u uuid := '74a9bd78-fcb3-4274-a2f4-27322939be7f';  -- UID do seu usuário de teste
  hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  c public.conta; r jsonb; j jsonb; d uuid; s numeric; n int;
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', u, 'role', 'authenticated')::text, true);

  -- Histórico esperado da conta de teste (saldo depois de cada evento):
  --  1) saldo inicial +500 -> 500   2) receita +1200 -> 1700   3) pagamento -200 -> 1500
  --  4) ajuste -50 -> 1450          5) exclusão +250 -> 1700   6) restauração -250 -> 1450
  c := public.criar_conta('TESTE Mov', 'corrente', 500);
  perform public.criar_receita(c.id, 'Salário', 1200, '2026-10-01', 'Salário');
  r := public.criar_despesa(c.id, 'Água', 200, '2026-10-15', 'Contas');
  d := (r->'despesa'->>'id')::uuid;
  perform public.pagar_despesa(d);
  perform public.editar_despesa(d, null, 250);
  perform public.excluir_despesa(d);
  perform public.restaurar_despesa(d);
  select saldo_disponivel into s from public.conta where id = c.id;
  assert s = 1450, '0: saldo final do cenário deveria ser 1450, deu ' || s;

  -- 1) total e ordem (mais recente primeiro) e saldo após fecha com o saldo da conta
  j := public.movimentacoes(c.id);
  assert (j->>'total')::int = 6, '1a: deveriam existir 6 movimentações, existem ' || (j->>'total');
  assert (j->'itens'->0->>'saldo_apos')::numeric = s, '1b: saldo após da mais recente deveria ser igual ao saldo da conta';
  assert j->'itens'->0->>'rotulo' = 'Reaplicada (restaurada)', '1c: rótulo da mais recente: ' || (j->'itens'->0->>'rotulo');
  assert (j->'itens'->5->>'saldo_apos')::numeric = 500 and j->'itens'->5->>'rotulo' = 'Saldo inicial',
         '1d: a mais antiga deveria ser o saldo inicial de 500';

  -- 2) saldo após de cada evento (do mais recente ao mais antigo)
  assert (select array_agg((i->>'saldo_apos')::numeric order by ord)
            from jsonb_array_elements(j->'itens') with ordinality as t(i, ord))
         = array[1450, 1700, 1450, 1500, 1700, 500]::numeric[],
         '2: sequência de saldos errada';

  -- 3) descrição vem do registro de origem
  assert j->'itens'->3->>'descricao' = 'Água' and j->'itens'->3->>'rotulo' = 'Despesa paga',
         '3a: o pagamento deveria mostrar a descrição Água';
  assert j->'itens'->4->>'descricao' = 'Salário' and (j->'itens'->4->>'valor')::numeric = 1200,
         '3b: a receita deveria mostrar Salário +1200';

  -- 4) filtro por origem
  assert (public.movimentacoes(c.id, null, null, 'receita')->>'total')::int = 1, '4a: receitas';
  assert (public.movimentacoes(c.id, null, null, 'despesa')->>'total')::int = 4, '4b: despesas';
  assert (public.movimentacoes(c.id, null, null, 'ajuste')->>'total')::int = 1, '4c: ajustes';

  -- 5) paginação: total continua 6; pega os itens 2 e 3 (a exclusão e o ajuste)
  j := public.movimentacoes(c.id, null, null, 'todas', 2, 1);
  assert jsonb_array_length(j->'itens') = 2 and (j->>'total')::int = 6, '5a: paginação (limit 2, offset 1)';
  assert (j->'itens'->0->>'valor')::numeric = 250, '5b: o segundo item deveria ser a exclusão (+250)';

  -- 6) filtro por data do evento
  assert (public.movimentacoes(c.id, hoje, hoje)->>'total')::int = 6, '6a: todos os eventos são de hoje';
  assert (public.movimentacoes(c.id, hoje + 1)->>'total')::int = 0, '6b: nada depois de hoje';
  assert (public.movimentacoes(c.id, null, hoje - 1)->>'total')::int = 0, '6c: nada antes de hoje';

  -- 7) conta excluída: some da listagem geral, mas aparece quando pedida pelo id
  perform public.excluir_conta(c.id);
  j := public.movimentacoes();
  select count(*) into n from jsonb_array_elements(j->'itens') i where i->>'conta_id' = c.id::text;
  assert n = 0, '7a: conta excluída não deveria aparecer na listagem geral';
  assert (public.movimentacoes(c.id)->>'total')::int = 6, '7b: pedida pelo id, o histórico continua';

  raise exception 'OK: todos os cenários de movimentações passaram (alterações revertidas de propósito)';
end $$;
