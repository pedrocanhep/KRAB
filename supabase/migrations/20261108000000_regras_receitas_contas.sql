-- Receitas são recebimentos efetivos; contas excluídas não aceitam alterações financeiras.
-- Aplicar após as migrations anteriores. Não altera dados existentes nem recorrências.

create or replace function public.criar_receita(
  p_conta_id uuid,
  p_descricao text,
  p_valor numeric,
  p_data date,
  p_categoria text,
  p_chave text default null
)
returns public.receita
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  r public.receita;
  rid uuid;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;

  -- alteração Pedro: criar receita aceitava data futura e creditava o saldo; agora a RPC rejeita recebimento posterior a hoje em São Paulo.
  if p_data > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'data_recebimento_invalida';
  end if;

  -- 1) trava a conta (também confirma que ela existe, é do usuário e não foi excluída)
  perform 1 from public.conta
   where id = p_conta_id and user_id = uid and deleted_at is null
   for update;
  if not found then raise exception 'conta_nao_encontrada'; end if;

  -- 2) idempotência: se a chave já foi usada, devolve a receita de antes e não grava nada
  if p_chave is not null then
    select receita_id into rid from public.idempotencia where user_id = uid and chave = p_chave;
    if found then
      select * into r from public.receita where id = rid;
      return r;
    end if;
  end if;

  insert into public.receita (user_id, conta_id, descricao, valor, data_recebimento, categoria)
  values (uid, p_conta_id, btrim(p_descricao), p_valor, p_data, btrim(p_categoria))
  returning * into r;

  perform public.reconciliar_receita(r.id, 'criacao');

  if p_chave is not null then
    insert into public.idempotencia (user_id, chave, receita_id) values (uid, p_chave, r.id);
  end if;

  return r;
end;
$$;

create or replace function public.editar_receita(
  p_id uuid,
  p_descricao text default null,
  p_valor numeric default null,
  p_data date default null,
  p_categoria text default null
)
returns public.receita
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_conta uuid;
  r public.receita;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;

  select conta_id into v_conta from public.receita where id = p_id and user_id = uid;
  if not found then raise exception 'receita_nao_encontrada'; end if;

  perform 1 from public.conta where id = v_conta for update;           -- conta primeiro
  select * into r from public.receita where id = p_id for update;      -- depois a receita

  if r.deleted_at is not null then raise exception 'estado_invalido'; end if;
  -- alteração Pedro: editar receita permitia manter ou informar recebimento futuro; agora a data resultante deve ser até hoje em São Paulo.
  if coalesce(p_data, r.data_recebimento) > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'data_recebimento_invalida';
  end if;

  update public.receita
     set descricao = coalesce(btrim(p_descricao), descricao),
         valor = coalesce(p_valor, valor),
         data_recebimento = coalesce(p_data, data_recebimento),
         categoria = coalesce(btrim(p_categoria), categoria),
         updated_at = now()
   where id = p_id
   returning * into r;

  perform public.reconciliar_receita(p_id, 'edicao');
  return r;
end;
$$;

create or replace function public.reconciliar_receita(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.receita%rowtype;
  alvo numeric(14,2);
  atual numeric(14,2);
begin
  select * into r from public.receita where id = p_id;
  alvo := case when r.deleted_at is null then r.valor else 0 end;

  select coalesce(sum(valor), 0) into atual
    from public.movimentacao_conta
   where origem_tipo = 'receita' and origem_id = p_id;

  if alvo <> atual then
    -- alteração Pedro: a reconciliação de receita alterava saldo mesmo em conta excluída; agora bloqueia diferenças financeiras até restaurar a conta.
    if exists (select 1 from public.conta where id = r.conta_id and deleted_at is not null) then
      raise exception 'conta_excluida';
    end if;

    insert into public.movimentacao_conta (user_id, conta_id, origem_tipo, origem_id, valor, motivo)
    values (r.user_id, r.conta_id, 'receita', p_id, alvo - atual, p_motivo);

    update public.conta
       set saldo_disponivel = saldo_disponivel + (alvo - atual)
     where id = r.conta_id;
  end if;
end;
$$;

create or replace function public.reconciliar_despesa(p_id uuid, p_motivo text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  d public.despesa%rowtype;
  alvo numeric(14,2);
  atual numeric(14,2);
begin
  select * into d from public.despesa where id = p_id;
  alvo := case when d.status = 'paga' and d.deleted_at is null then -d.valor_pago else 0 end;

  select coalesce(sum(valor), 0) into atual
    from public.movimentacao_conta
   where origem_tipo = 'despesa' and origem_id = p_id;

  if alvo <> atual then
    -- alteração Pedro: a reconciliação de despesa permitia estorno em conta excluída; agora qualquer diferença financeira exige conta restaurada.
    if exists (select 1 from public.conta where id = d.conta_id and deleted_at is not null) then
      raise exception 'conta_excluida';
    end if;

    insert into public.movimentacao_conta (user_id, conta_id, origem_tipo, origem_id, valor, motivo)
    values (d.user_id, d.conta_id, 'despesa', p_id, alvo - atual, p_motivo);

    update public.conta
       set saldo_disponivel = saldo_disponivel + (alvo - atual)
     where id = d.conta_id;
  end if;
end;
$$;

create or replace function public.excluir_conta(p_id uuid)
returns public.conta
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  c public.conta;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;

  select * into c from public.conta where id = p_id and user_id = uid for update;
  if not found then raise exception 'conta_nao_encontrada'; end if;
  if c.deleted_at is not null then return c; end if;

  if exists (
    select 1 from public.despesa
     where conta_id = p_id and status = 'pendente' and deleted_at is null
  ) then
    raise exception 'conta_com_pendencias';
  end if;

  -- alteração Pedro: excluir conta exigia apenas ausência de pendências ativas; agora também exige saldo disponível igual a zero.
  if c.saldo_disponivel <> 0 then raise exception 'conta_com_saldo'; end if;

  update public.conta set deleted_at = now(), updated_at = now()
   where id = p_id returning * into c;
  return c;
end;
$$;

create or replace function public.pagar_despesa(p_id uuid, p_data date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_conta uuid;
  d public.despesa%rowtype;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;
  if p_data is not null and p_data > v_hoje then raise exception 'data_pagamento_invalida'; end if;

  select conta_id into v_conta from public.despesa where id = p_id and user_id = uid;
  if not found then raise exception 'despesa_nao_encontrada'; end if;

  perform 1 from public.conta where id = v_conta for update;
  -- alteração Pedro: pagamento de despesa não verificava conta excluída; agora a pagamento exige restaurar a conta antes de prosseguir.
  if exists (select 1 from public.conta where id = v_conta and deleted_at is not null) then
    raise exception 'conta_excluida';
  end if;

  select * into d from public.despesa where id = p_id for update;

  if d.conta_id <> v_conta then raise exception 'conflito_concorrencia'; end if;
  if d.deleted_at is not null then raise exception 'estado_invalido'; end if;
  if d.status = 'paga' then return public.montar_resultado_despesa(p_id); end if;  -- já paga: nada a fazer

  update public.despesa
     set status = 'paga',
         data_pagamento = coalesce(p_data, v_hoje),
         valor_pago = valor,
         updated_at = now()
   where id = p_id;

  perform public.reconciliar_despesa(p_id, 'pagamento');
  return public.montar_resultado_despesa(p_id);
end;
$$;

create or replace function public.editar_despesa(
  p_id uuid,
  p_descricao text default null,
  p_valor numeric default null,
  p_vencimento date default null,
  p_categoria text default null,
  p_conta_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_conta uuid;
  d public.despesa%rowtype;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;

  select conta_id into v_conta from public.despesa where id = p_id and user_id = uid;
  if not found then raise exception 'despesa_nao_encontrada'; end if;

  if p_conta_id is not null and p_conta_id <> v_conta then
    perform 1 from public.conta where id = p_conta_id and user_id = uid and deleted_at is null;
    if not found then raise exception 'conta_nao_encontrada'; end if;
    -- trava as duas contas sempre na mesma ordem (evita deadlock)
    perform 1 from public.conta where id in (v_conta, p_conta_id) order by id for update;
  else
    perform 1 from public.conta where id = v_conta for update;
  end if;

  -- alteração Pedro: edição de despesa não verificava conta excluída; agora a edição exige restaurar a conta antes de prosseguir.
  if exists (select 1 from public.conta where id = v_conta and deleted_at is not null) then
    raise exception 'conta_excluida';
  end if;
  -- alteração Pedro: a conta destino era validada somente antes dos locks; agora é revalidada após o bloqueio para impedir uso de destino excluído.
  -- Revalida o destino depois dos locks, inclusive se houve exclusão concorrente.
  if p_conta_id is not null and p_conta_id <> v_conta then
    perform 1 from public.conta where id = p_conta_id and user_id = uid and deleted_at is null;
    if not found then raise exception 'conta_nao_encontrada'; end if;
  end if;

  select * into d from public.despesa where id = p_id for update;

  if d.conta_id <> v_conta then raise exception 'conflito_concorrencia'; end if;
  if d.deleted_at is not null then raise exception 'estado_invalido'; end if;
  if p_conta_id is not null and p_conta_id <> v_conta and d.status = 'paga' then
    raise exception 'conta_nao_alteravel';
  end if;

  update public.despesa
     set descricao = coalesce(btrim(p_descricao), descricao),
         valor = coalesce(p_valor, valor),
         data_vencimento = coalesce(p_vencimento, data_vencimento),
         categoria = coalesce(btrim(p_categoria), categoria),
         conta_id = coalesce(p_conta_id, conta_id),
         valor_pago = case when status = 'paga' then coalesce(p_valor, valor) else null end,
         updated_at = now()
   where id = p_id;

  perform public.reconciliar_despesa(p_id, 'edicao');
  return public.montar_resultado_despesa(p_id);
end;
$$;

create or replace function public.restaurar_despesa(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_conta uuid;
  d public.despesa%rowtype;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;

  select conta_id into v_conta from public.despesa where id = p_id and user_id = uid;
  if not found then raise exception 'despesa_nao_encontrada'; end if;

  perform 1 from public.conta where id = v_conta for update;
  -- alteração Pedro: restauração de despesa não verificava conta excluída; agora a restauração exige restaurar a conta antes de prosseguir.
  if exists (select 1 from public.conta where id = v_conta and deleted_at is not null) then
    raise exception 'conta_excluida';
  end if;

  select * into d from public.despesa where id = p_id for update;

  if d.conta_id <> v_conta then raise exception 'conflito_concorrencia'; end if;
  if d.deleted_at is null then return public.montar_resultado_despesa(p_id); end if;

  update public.despesa set deleted_at = null, updated_at = now() where id = p_id;

  perform public.reconciliar_despesa(p_id, 'restauracao');
  return public.montar_resultado_despesa(p_id);
end;
$$;
