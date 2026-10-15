

create table public.despesa (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  conta_id uuid not null references public.conta(id),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 100),
  valor numeric(14,2) not null check (valor > 0),
  data_vencimento date not null,
  categoria text not null check (char_length(btrim(categoria)) between 1 and 50),
  status text not null default 'pendente' check (status in ('pendente', 'paga')),
  data_pagamento date,
  valor_pago numeric(14,2),          -- pagamento integral: sempre igual ao valor da despesa
  deleted_at timestamptz,            -- exclusão lógica
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint despesa_pagamento_coerente check (
    (status = 'pendente' and data_pagamento is null and valor_pago is null)
    or
    (status = 'paga' and data_pagamento is not null and valor_pago is not null and valor_pago > 0)
  )
);
create index despesa_user_venc_idx on public.despesa (user_id, data_vencimento);
create index despesa_conta_idx on public.despesa (conta_id);
create index despesa_pendentes_idx on public.despesa (user_id, data_vencimento)
  where status = 'pendente' and deleted_at is null;

create table public.idempotencia_despesa (
  user_id uuid not null references auth.users(id),
  chave text not null,
  despesa_id uuid not null references public.despesa(id),
  created_at timestamptz not null default now(),
  primary key (user_id, chave)
);


alter table public.despesa enable row level security;
alter table public.idempotencia_despesa enable row level security;

revoke all on public.despesa, public.idempotencia_despesa from anon, authenticated;
grant select on public.despesa to authenticated;

create policy despesa_select_own on public.despesa
  for select to authenticated using (user_id = auth.uid());

create function public.reconciliar_despesa(p_id uuid, p_motivo text)
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
    insert into public.movimentacao_conta (user_id, conta_id, origem_tipo, origem_id, valor, motivo)
    values (d.user_id, d.conta_id, 'despesa', p_id, alvo - atual, p_motivo);

    update public.conta
       set saldo_disponivel = saldo_disponivel + (alvo - atual)
     where id = d.conta_id;
  end if;
end;
$$;


create function public.montar_resultado_despesa(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'despesa', to_jsonb(d),
    'saldo_conta', c.saldo_disponivel,
    'saldo_negativo', c.saldo_disponivel < 0
  )
  from public.despesa d
  join public.conta c on c.id = d.conta_id
  where d.id = p_id;
$$;

create function public.criar_despesa(
  p_conta_id uuid,
  p_descricao text,
  p_valor numeric,
  p_vencimento date,
  p_categoria text,
  p_chave text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  d_id uuid;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;

  perform 1 from public.conta
   where id = p_conta_id and user_id = uid and deleted_at is null
   for update;
  if not found then raise exception 'conta_nao_encontrada'; end if;

  if p_chave is not null then
    select despesa_id into d_id from public.idempotencia_despesa
     where user_id = uid and chave = p_chave;
    if found then return public.montar_resultado_despesa(d_id); end if;
  end if;

  insert into public.despesa (user_id, conta_id, descricao, valor, data_vencimento, categoria)
  values (uid, p_conta_id, btrim(p_descricao), p_valor, p_vencimento, btrim(p_categoria))
  returning id into d_id;

  if p_chave is not null then
    insert into public.idempotencia_despesa (user_id, chave, despesa_id) values (uid, p_chave, d_id);
  end if;

  return public.montar_resultado_despesa(d_id);
end;
$$;

-- Pagar: único momento em que o saldo desce. Pagamento integral. Repetir não faz nada.
create function public.pagar_despesa(p_id uuid, p_data date default null)
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


create function public.editar_despesa(
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

-- Excluir (lógico): se estava paga, estorna o débito. Repetir não faz nada.
create function public.excluir_despesa(p_id uuid)
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
  select * into d from public.despesa where id = p_id for update;

  if d.conta_id <> v_conta then raise exception 'conflito_concorrencia'; end if;
  if d.deleted_at is not null then return public.montar_resultado_despesa(p_id); end if;

  update public.despesa set deleted_at = now(), updated_at = now() where id = p_id;

  perform public.reconciliar_despesa(p_id, 'exclusao');
  return public.montar_resultado_despesa(p_id);
end;
$$;

create function public.restaurar_despesa(p_id uuid)
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
  select * into d from public.despesa where id = p_id for update;

  if d.conta_id <> v_conta then raise exception 'conflito_concorrencia'; end if;
  if d.deleted_at is null then return public.montar_resultado_despesa(p_id); end if;

  update public.despesa set deleted_at = null, updated_at = now() where id = p_id;

  perform public.reconciliar_despesa(p_id, 'restauracao');
  return public.montar_resultado_despesa(p_id);
end;
$$;

revoke all on function public.reconciliar_despesa(uuid, text) from public, anon, authenticated;
revoke all on function public.montar_resultado_despesa(uuid) from public, anon, authenticated;

revoke all on function public.criar_despesa(uuid, text, numeric, date, text, text) from public, anon;
revoke all on function public.pagar_despesa(uuid, date) from public, anon;
revoke all on function public.editar_despesa(uuid, text, numeric, date, text, uuid) from public, anon;
revoke all on function public.excluir_despesa(uuid) from public, anon;
revoke all on function public.restaurar_despesa(uuid) from public, anon;

grant execute on function public.criar_despesa(uuid, text, numeric, date, text, text) to authenticated;
grant execute on function public.pagar_despesa(uuid, date) to authenticated;
grant execute on function public.editar_despesa(uuid, text, numeric, date, text, uuid) to authenticated;
grant execute on function public.excluir_despesa(uuid) to authenticated;
grant execute on function public.restaurar_despesa(uuid) to authenticated;
