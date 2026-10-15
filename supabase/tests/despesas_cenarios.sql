
do $$
declare
  u uuid := '74a9bd78-fcb3-4274-a2f4-27322939be7f';  
  c1 uuid; c2 uuid; d1 uuid; d2 uuid; d3 uuid; d4 uuid;
  r jsonb; s numeric; n int;
begin
  insert into public.conta (user_id, nome) values (u, 'TESTE-1') returning id into c1;
  insert into public.conta (user_id, nome) values (u, 'TESTE-2') returning id into c2;
  perform set_config('request.jwt.claims',
                     json_build_object('sub', u, 'role', 'authenticated')::text, true);

  r := public.criar_despesa(c1, 'Conta de água', 200, '2026-10-15', 'Contas');
  d1 := (r->'despesa'->>'id')::uuid;
  assert r->'despesa'->>'status' = 'pendente', '1: deveria nascer pendente';
  select saldo_disponivel into s from public.conta where id = c1;
  assert s = 0, '1: despesa pendente não pode mexer no saldo';

  r := public.pagar_despesa(d1);
  select saldo_disponivel into s from public.conta where id = c1;
  assert s = -200, '2: pagar deveria debitar 200, saldo=' || s;
  assert (r->>'saldo_negativo')::boolean, '2: deveria avisar saldo negativo';

  perform public.pagar_despesa(d1);
  select saldo_disponivel into s from public.conta where id = c1;
  select count(*) into n from public.movimentacao_conta where origem_id = d1;
  assert s = -200 and n = 1, '3: pagamento repetido duplicou efeito (saldo=' || s || ', linhas=' || n || ')';

  perform public.editar_despesa(d1, null, 250);
  select saldo_disponivel into s from public.conta where id = c1;
  assert s = -250, '4: editar para 250 deveria dar saldo -250, deu ' || s;

  begin
    perform public.editar_despesa(d1, null, null, null, null, c2);
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%conta_nao_alteravel%', '5: erro inesperado: ' || sqlerrm;
  end;

  perform public.excluir_despesa(d1);
  perform public.excluir_despesa(d1);
  select saldo_disponivel into s from public.conta where id = c1;
  assert s = 0, '6: excluir deveria estornar (saldo 0), deu ' || s;

  begin
    perform public.editar_despesa(d1, 'x');
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%estado_invalido%', '7a: erro inesperado: ' || sqlerrm;
  end;
  begin
    perform public.pagar_despesa(d1);
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%estado_invalido%', '7b: erro inesperado: ' || sqlerrm;
  end;

  perform public.restaurar_despesa(d1);
  perform public.restaurar_despesa(d1);
  select saldo_disponivel into s from public.conta where id = c1;
  assert s = -250, '8: restaurar deveria reaplicar -250, deu ' || s;

  -- 9) ledger consistente com o saldo
  select coalesce(sum(valor), 0) into s from public.movimentacao_conta where conta_id = c1;
  select saldo_disponivel into n from public.conta where id = c1;
  assert s = n, '9: soma do ledger (' || s || ') diferente do saldo (' || n || ')';

  r := public.criar_despesa(c1, 'Internet', 80, '2026-10-20', 'Contas');
  d2 := (r->'despesa'->>'id')::uuid;
  perform public.excluir_despesa(d2);
  perform public.restaurar_despesa(d2);
  select saldo_disponivel into s from public.conta where id = c1;
  assert s = -250, '10a: pendente não pode mexer no saldo, deu ' || s;
  r := public.editar_despesa(d2, null, null, null, null, c2);
  assert (r->'despesa'->>'conta_id')::uuid = c2, '10b: pendente deveria poder trocar de conta';

  -- 11) pagar na nova conta debita só a nova conta
  perform public.pagar_despesa(d2);
  select saldo_disponivel into s from public.conta where id = c2;
  assert s = -80, '11a: conta 2 deveria estar em -80, deu ' || s;
  select saldo_disponivel into s from public.conta where id = c1;
  assert s = -250, '11b: conta 1 não deveria mudar, deu ' || s;

  -- 12) idempotência na criação
  r := public.criar_despesa(c1, 'Luz', 100, '2026-10-25', 'Contas', 'chave-teste-0001');
  d3 := (r->'despesa'->>'id')::uuid;
  r := public.criar_despesa(c1, 'Luz', 100, '2026-10-25', 'Contas', 'chave-teste-0001');
  d4 := (r->'despesa'->>'id')::uuid;
  assert d3 = d4, '12: mesma chave deveria devolver a mesma despesa';

  begin
    perform public.pagar_despesa(d3, current_date + 5);
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%data_pagamento_invalida%', '13: erro inesperado: ' || sqlerrm;
  end;

  raise exception 'OK: todos os 13 cenários passaram (alterações revertidas de propósito)';
end $$;
