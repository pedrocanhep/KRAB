-- Teste das regras de CONTA direto no banco. Não deixa nada gravado:
-- ao final levanta uma exceção de propósito, que desfaz TUDO.
--   * Se passar:  aparece um "erro" começando com  OK: ...
--   * Se falhar:  aparece a mensagem do cenário que falhou.
do $$
declare
  u uuid := '74a9bd78-fcb3-4274-a2f4-27322939be7f';  -- UID do seu usuário de teste
  c1 public.conta; c2 public.conta; c3 public.conta;
  d1 uuid; r jsonb; s numeric; n int; t text; ag text;
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', u, 'role', 'authenticated')::text, true);

  -- 1) criar com saldo inicial: saldo + uma linha 'saldo_inicial' no ledger
  c1 := public.criar_conta('TESTE Banco A', 'corrente', 500, '260', '1234', '567890', '1');
  assert c1.saldo_disponivel = 500, '1a: saldo inicial deveria ser 500';
  select count(*) into n from public.movimentacao_conta
   where conta_id = c1.id and motivo = 'saldo_inicial' and valor = 500;
  assert n = 1, '1b: deveria existir 1 lançamento de saldo inicial, existem ' || n;

  -- 2) criar sem saldo inicial: saldo 0 e nenhuma linha no ledger
  c2 := public.criar_conta('TESTE Caixa', 'caixa');
  assert c2.saldo_disponivel = 0 and c2.tipo = 'caixa', '2a: caixa deveria ter saldo 0';
  select count(*) into n from public.movimentacao_conta where conta_id = c2.id;
  assert n = 0, '2b: saldo zero não deveria gerar lançamento';

  -- 3) nome duplicado (ignora maiúsculas e espaços) é recusado
  begin
    perform public.criar_conta('  teste banco a ');
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%nome_ja_existe%', '3: erro inesperado: ' || sqlerrm;
  end;

  -- 4) tipo inválido é recusado pelo banco (check = 23514)
  begin
    perform public.criar_conta('TESTE X', 'poupanca2');
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlstate = '23514', '4: esperado 23514, veio ' || sqlstate || ' ' || sqlerrm;
  end;

  -- 5) editar: muda cadastro, NÃO mexe no saldo; '' limpa o campo; null não mexe
  c1 := public.editar_conta(c1.id, 'TESTE Banco A2', 'poupanca', null, null, null, null);
  assert c1.nome = 'TESTE Banco A2' and c1.tipo = 'poupanca', '5a: nome/tipo não mudaram';
  assert c1.saldo_disponivel = 500, '5b: editar não pode mexer no saldo';
  assert c1.agencia = '1234', '5c: campo enviado como null deveria ficar como estava';
  c1 := public.editar_conta(c1.id, null, null, null, '', null, null);
  assert c1.agencia is null, '5d: campo enviado como vazio deveria ser limpo';

  -- 6) editar para o nome de outra conta ativa é recusado
  begin
    perform public.editar_conta(c1.id, 'TESTE Caixa');
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%nome_ja_existe%', '6: erro inesperado: ' || sqlerrm;
  end;

  -- 7) conta com despesa PENDENTE não pode ser excluída
  r := public.criar_despesa(c1.id, 'Luz', 200, '2026-10-15', 'Contas');
  d1 := (r->'despesa'->>'id')::uuid;
  begin
    perform public.excluir_conta(c1.id);
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%conta_com_pendencias%', '7: erro inesperado: ' || sqlerrm;
  end;

  -- 8) paga a despesa: agora pode excluir; saldo preservado; repetir não faz nada
  perform public.pagar_despesa(d1);
  c1 := public.excluir_conta(c1.id);
  assert c1.deleted_at is not null, '8a: conta deveria estar excluída';
  c1 := public.excluir_conta(c1.id);
  select saldo_disponivel into s from public.conta where id = c1.id;
  assert s = 300, '8b: saldo deveria continuar 300 (500 - 200), deu ' || s;

  -- 9) conta excluída: não edita e não aceita novos lançamentos
  begin
    perform public.editar_conta(c1.id, 'qualquer');
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%estado_invalido%', '9a: erro inesperado: ' || sqlerrm;
  end;
  begin
    perform public.criar_despesa(c1.id, 'Teste', 10, '2026-10-20', 'Contas');
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%conta_nao_encontrada%', '9b: erro inesperado: ' || sqlerrm;
  end;

  -- 10) restaurar; repetir não faz nada
  c1 := public.restaurar_conta(c1.id);
  c1 := public.restaurar_conta(c1.id);
  assert c1.deleted_at is null, '10: conta deveria estar ativa';

  -- 11) restaurar com nome já ocupado por outra conta ativa é recusado
  c1 := public.excluir_conta(c1.id);
  c3 := public.criar_conta('TESTE Banco A2');     -- o nome ficou livre enquanto c1 estava excluída
  begin
    perform public.restaurar_conta(c1.id);
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%nome_ja_existe%', '11: erro inesperado: ' || sqlerrm;
  end;

  -- 12) o ledger fecha com o saldo (500 inicial - 200 pagos = 300)
  select coalesce(sum(valor), 0) into s from public.movimentacao_conta where conta_id = c1.id;
  assert s = 300, '12: soma do ledger deveria ser 300, deu ' || s;

  raise exception 'OK: todos os 12 cenários passaram (alterações revertidas de propósito)';
end $$;
