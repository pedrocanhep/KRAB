-- Teste das regras de RECORRÊNCIA direto no banco. Não deixa nada gravado:
-- ao final levanta uma exceção de propósito, que desfaz TUDO.
--   * Se passar:  aparece um "erro" começando com  OK: ...
--   * Se falhar:  aparece a mensagem do cenário que falhou.
do $$
declare
  u uuid := '74a9bd78-fcb3-4274-a2f4-27322939be7f';  -- UID do seu usuário de teste
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  c1 public.conta;
  r jsonb; rec uuid; rec2 uuid; rec3 uuid; d1 uuid; d2 uuid;
  n int; n2 int; s numeric; st text; g int;
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', u, 'role', 'authenticated')::text, true);
  c1 := public.criar_conta('TESTE Rec', 'corrente', 0);

  -- 1) diária com fim: 10 ocorrências PENDENTES e o saldo não se mexe
  r := public.criar_despesa_recorrente(c1.id, 'Marmita', 100, 'Alimentação', 'diaria', v_hoje, v_hoje + 9);
  rec := (r->'recorrencia'->>'id')::uuid;
  assert (r->>'ocorrencias_geradas')::int = 10, '1a: deveriam ser geradas 10 ocorrências, geradas ' || (r->>'ocorrencias_geradas');
  select count(*) into n from public.despesa where recorrencia_id = rec and status = 'pendente' and deleted_at is null;
  assert n = 10, '1b: as 10 ocorrências deveriam estar pendentes, estão ' || n;
  select saldo_disponivel into s from public.conta where id = c1.id;
  assert s = 0, '1c: ocorrências pendentes não podem mexer no saldo, saldo=' || s;

  -- 2) gerar de novo não duplica
  r := public.gerar_minhas_ocorrencias();
  select count(*) into n from public.despesa where recorrencia_id = rec;
  assert n = 10, '2: gerar de novo duplicou ocorrências (agora ' || n || ')';

  -- 3) pagar UMA ocorrência não encerra a recorrência; debita só aquela
  select id into d1 from public.despesa where recorrencia_id = rec and data_vencimento = v_hoje;
  perform public.pagar_despesa(d1);
  select status into st from public.despesa_recorrente where id = rec;
  assert st = 'ativa', '3a: pagar uma ocorrência não pode encerrar a recorrência';
  select saldo_disponivel into s from public.conta where id = c1.id;
  assert s = -100, '3b: pagar deveria debitar 100, saldo=' || s;
  select count(*) into n from public.despesa where recorrencia_id = rec;
  assert n = 10, '3c: pagar não pode criar nem apagar ocorrências';

  -- 4) editar valor: vale para as PENDENTES futuras; a paga não muda
  perform public.editar_despesa_recorrente(rec, null, 150);
  select valor into s from public.despesa where id = d1;
  assert s = 100, '4a: a ocorrência paga não pode mudar de valor, está ' || s;
  select count(*) into n from public.despesa
   where recorrencia_id = rec and status = 'pendente' and valor = 150 and deleted_at is null;
  assert n = 9, '4b: as 9 pendentes deveriam ter virado 150, virou ' || n;

  -- 5) encurtar a data final exclui as pendentes depois dela
  perform public.editar_despesa_recorrente(rec, null, null, null, null, v_hoje + 4);
  select count(*) into n from public.despesa where recorrencia_id = rec and deleted_at is null;
  select count(*) into n2 from public.despesa where recorrencia_id = rec and deleted_at is not null;
  assert n = 5 and n2 = 5, '5: esperado 5 ativas e 5 excluídas, deu ' || n || ' e ' || n2;

  -- 6) estender a data final NÃO recria as já excluídas
  r := public.editar_despesa_recorrente(rec, null, null, null, null, v_hoje + 6);
  assert (r->>'ocorrencias_geradas')::int = 0, '6a: ocorrência excluída não deveria ser recriada';
  select count(*) into n from public.despesa where recorrencia_id = rec and deleted_at is null;
  assert n = 5, '6b: continuam 5 ativas, deu ' || n;

  -- 7) finalizar: exclui só as pendentes futuras; paga e histórico ficam; repetir não faz nada
  r := public.finalizar_despesa_recorrente(rec);
  assert r->'recorrencia'->>'status' = 'finalizada', '7a: deveria estar finalizada';
  assert (r->>'ocorrencias_canceladas')::int = 4, '7b: deveriam ser canceladas 4, canceladas ' || (r->>'ocorrencias_canceladas');
  select count(*) into n from public.despesa where recorrencia_id = rec and deleted_at is null;
  assert n = 1, '7c: deveria sobrar só a ocorrência paga, sobraram ' || n;
  select saldo_disponivel into s from public.conta where id = c1.id;
  assert s = -100, '7d: o saldo da ocorrência paga deve continuar, saldo=' || s;
  r := public.finalizar_despesa_recorrente(rec);
  assert (r->>'ocorrencias_canceladas')::int = 0, '7e: finalizar de novo não deveria fazer nada';

  -- 8) finalizada não edita e não gera mais
  begin
    perform public.editar_despesa_recorrente(rec, 'x');
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%estado_invalido%', '8a: erro inesperado: ' || sqlerrm;
  end;
  perform public.gerar_minhas_ocorrencias();
  select count(*) into n from public.despesa where recorrencia_id = rec and deleted_at is null;
  assert n = 1, '8b: finalizada não pode gerar novas ocorrências';

  -- 9) semanal sem fim: 9 ocorrências na janela de 60 dias
  r := public.criar_despesa_recorrente(c1.id, 'Feira', 60, 'Alimentação', 'semanal', v_hoje);
  rec2 := (r->'recorrencia'->>'id')::uuid;
  assert (r->>'ocorrencias_geradas')::int = 9, '9: semanal deveria gerar 9, gerou ' || (r->>'ocorrencias_geradas');

  -- 10) mensal: dia 31 cai no último dia do mês (testado com "hoje" = 15/01/2030)
  r := public.criar_despesa_recorrente(c1.id, 'Seguro', 50, 'Contas', 'mensal', '2030-01-31');
  rec3 := (r->'recorrencia'->>'id')::uuid;
  assert (r->>'ocorrencias_geradas')::int = 0, '10a: início em 2030 não deveria gerar nada hoje';
  g := public.gerar_ocorrencias_interno(rec3, '2030-01-15');
  assert g = 2, '10b: deveriam existir 2 ocorrências (31/01 e 28/02), geradas ' || g;
  select count(*) into n from public.despesa
   where recorrencia_id = rec3 and data_vencimento in ('2030-01-31', '2030-02-28');
  assert n = 2, '10c: as datas deveriam ser 31/01 e 28/02';

  -- 11) ocorrência excluída por conta própria não volta quando o gerador roda
  select id into d2 from public.despesa where recorrencia_id = rec2 and data_vencimento = v_hoje + 7;
  perform public.excluir_despesa(d2);
  g := public.gerar_ocorrencias_interno(rec2, v_hoje);
  select count(*) into n from public.despesa where recorrencia_id = rec2;
  select count(*) into n2 from public.despesa where recorrencia_id = rec2 and deleted_at is null;
  assert g = 0 and n = 9 and n2 = 8, '11: ocorrência excluída foi recriada (geradas ' || g || ', total ' || n || ')';

  -- 12) validações
  begin
    perform public.criar_despesa_recorrente(c1.id, 'Antiga', 10, 'X', 'diaria', v_hoje - 40);
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%inicio_muito_antigo%', '12a: erro inesperado: ' || sqlerrm;
  end;
  begin
    perform public.criar_despesa_recorrente(c1.id, 'Fim errado', 10, 'X', 'diaria', v_hoje, v_hoje - 1);
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlstate = '23514', '12b: esperado 23514, veio ' || sqlstate || ' ' || sqlerrm;
  end;
  begin
    perform public.criar_despesa_recorrente(c1.id, 'Anual', 10, 'X', 'anual', v_hoje);
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlstate = '23514', '12c: esperado 23514, veio ' || sqlstate || ' ' || sqlerrm;
  end;

  raise exception 'OK: todos os cenários de recorrência passaram (alterações revertidas de propósito)';
end $$;
