
create table public.despesa_recorrente (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  conta_id uuid not null references public.conta(id),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 100),
  valor numeric(14,2) not null check (valor > 0),
  categoria text not null check (char_length(btrim(categoria)) between 1 and 50),
  frequencia text not null check (frequencia in ('diaria', 'semanal', 'mensal')),
  data_inicio date not null,
  data_fim date,
  status text not null default 'ativa' check (status in ('ativa', 'finalizada')),
  finalizada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rec_fim_valido check (data_fim is null or data_fim >= data_inicio),
  constraint rec_final_coerente check (
    (status = 'ativa' and finalizada_em is null)
    or (status = 'finalizada' and finalizada_em is not null)
  )
);
create index rec_user_status_idx on public.despesa_recorrente (user_id, status);

alter table public.despesa
  add column recorrencia_id uuid references public.despesa_recorrente(id);

create unique index despesa_ocorrencia_unica_idx
  on public.despesa (recorrencia_id, data_vencimento)
  where recorrencia_id is not null;
create index despesa_recorrencia_idx on public.despesa (recorrencia_id);

alter table public.despesa_recorrente enable row level security;
revoke all on public.despesa_recorrente from anon, authenticated;
grant select on public.despesa_recorrente to authenticated;
create policy rec_select_own on public.despesa_recorrente
  for select to authenticated using (user_id = auth.uid());

create function public.gerar_ocorrencias_interno(p_rec uuid, p_hoje date)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  r public.despesa_recorrente%rowtype;
  limite date;
  n int := 0;
  v_data date;
  v_ins int;
  v_total int := 0;
begin
  select * into r from public.despesa_recorrente where id = p_rec;
  if not found or r.status <> 'ativa' then return 0; end if;

  perform 1 from public.conta where id = r.conta_id and deleted_at is null;
  if not found then return 0; end if;

  limite := least(coalesce(r.data_fim, p_hoje + 60), p_hoje + 60);

  loop
    v_data := case r.frequencia
                when 'diaria' then r.data_inicio + n
                when 'semanal' then r.data_inicio + 7 * n
                else (r.data_inicio + make_interval(months => n))::date
              end;
    exit when v_data > limite;

    insert into public.despesa (user_id, conta_id, descricao, valor, data_vencimento, categoria, recorrencia_id)
    values (r.user_id, r.conta_id, r.descricao, r.valor, v_data, r.categoria, r.id)
    on conflict (recorrencia_id, data_vencimento) where recorrencia_id is not null do nothing;

    get diagnostics v_ins = row_count;
    v_total := v_total + v_ins;
    n := n + 1;
  end loop;

  return v_total;
end;
$$;


create function public.criar_despesa_recorrente(
  p_conta_id uuid,
  p_descricao text,
  p_valor numeric,
  p_categoria text,
  p_frequencia text,
  p_inicio date,
  p_fim date default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r public.despesa_recorrente%rowtype;
  v_qtd int;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;
  if p_inicio < v_hoje - 31 then raise exception 'inicio_muito_antigo'; end if;

  perform 1 from public.conta
   where id = p_conta_id and user_id = uid and deleted_at is null
   for update;
  if not found then raise exception 'conta_nao_encontrada'; end if;

  insert into public.despesa_recorrente
    (user_id, conta_id, descricao, valor, categoria, frequencia, data_inicio, data_fim)
  values
    (uid, p_conta_id, btrim(p_descricao), p_valor, btrim(p_categoria), p_frequencia, p_inicio, p_fim)
  returning * into r;

  v_qtd := public.gerar_ocorrencias_interno(r.id, v_hoje);
  return jsonb_build_object('recorrencia', to_jsonb(r), 'ocorrencias_geradas', v_qtd);
end;
$$;

create function public.editar_despesa_recorrente(
  p_id uuid,
  p_descricao text default null,
  p_valor numeric default null,
  p_categoria text default null,
  p_conta_id uuid default null,
  p_fim date default null,
  p_limpar_fim boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r public.despesa_recorrente%rowtype;
  v_qtd int;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;

  select * into r from public.despesa_recorrente where id = p_id and user_id = uid for update;
  if not found then raise exception 'recorrencia_nao_encontrada'; end if;
  if r.status <> 'ativa' then raise exception 'estado_invalido'; end if;

  if p_conta_id is not null and p_conta_id <> r.conta_id then
    perform 1 from public.conta where id = p_conta_id and user_id = uid and deleted_at is null;
    if not found then raise exception 'conta_nao_encontrada'; end if;
  end if;

  update public.despesa_recorrente
     set descricao = coalesce(btrim(p_descricao), descricao),
         valor = coalesce(p_valor, valor),
         categoria = coalesce(btrim(p_categoria), categoria),
         conta_id = coalesce(p_conta_id, conta_id),
         data_fim = case when p_limpar_fim then null
                         when p_fim is not null then p_fim
                         else data_fim end,
         updated_at = now()
   where id = p_id
   returning * into r;

  -- só PENDENTES futuras mudam (pendente não tem efeito no saldo, então não há ledger aqui)
  update public.despesa
     set descricao = r.descricao, valor = r.valor, categoria = r.categoria,
         conta_id = r.conta_id, updated_at = now()
   where recorrencia_id = p_id and status = 'pendente' and deleted_at is null
     and data_vencimento >= v_hoje;

  -- data final encurtada: as pendentes depois dela saem (exclusão lógica)
  if r.data_fim is not null then
    update public.despesa set deleted_at = now(), updated_at = now()
     where recorrencia_id = p_id and status = 'pendente' and deleted_at is null
       and data_vencimento > r.data_fim;
  end if;

  v_qtd := public.gerar_ocorrencias_interno(p_id, v_hoje);
  return jsonb_build_object('recorrencia', to_jsonb(r), 'ocorrencias_geradas', v_qtd);
end;
$$;

create function public.finalizar_despesa_recorrente(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  r public.despesa_recorrente%rowtype;
  v_qtd int := 0;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;

  select * into r from public.despesa_recorrente where id = p_id and user_id = uid for update;
  if not found then raise exception 'recorrencia_nao_encontrada'; end if;
  if r.status = 'finalizada' then
    return jsonb_build_object('recorrencia', to_jsonb(r), 'ocorrencias_canceladas', 0);
  end if;

  update public.despesa_recorrente
     set status = 'finalizada', finalizada_em = now(), updated_at = now()
   where id = p_id
   returning * into r;

  with canc as (
    update public.despesa set deleted_at = now(), updated_at = now()
     where recorrencia_id = p_id and status = 'pendente' and deleted_at is null
       and data_vencimento > v_hoje
     returning 1
  )
  select count(*) into v_qtd from canc;

  return jsonb_build_object('recorrencia', to_jsonb(r), 'ocorrencias_canceladas', v_qtd);
end;
$$;

create function public.gerar_minhas_ocorrencias()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  rec record;
  v_total int := 0;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;

  for rec in
    select id from public.despesa_recorrente where user_id = uid and status = 'ativa'
  loop
    v_total := v_total + public.gerar_ocorrencias_interno(rec.id, v_hoje);
  end loop;

  return jsonb_build_object('ocorrencias_geradas', v_total);
end;
$$;

create function public.gerar_ocorrencias_todas()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  rec record;
  v_total int := 0;
begin
  for rec in select id from public.despesa_recorrente where status = 'ativa'
  loop
    v_total := v_total + public.gerar_ocorrencias_interno(rec.id, v_hoje);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.gerar_ocorrencias_interno(uuid, date) from public, anon, authenticated;
revoke all on function public.gerar_ocorrencias_todas() from public, anon, authenticated;

revoke all on function public.criar_despesa_recorrente(uuid, text, numeric, text, text, date, date) from public, anon;
revoke all on function public.editar_despesa_recorrente(uuid, text, numeric, text, uuid, date, boolean) from public, anon;
revoke all on function public.finalizar_despesa_recorrente(uuid) from public, anon;
revoke all on function public.gerar_minhas_ocorrencias() from public, anon;

grant execute on function public.criar_despesa_recorrente(uuid, text, numeric, text, text, date, date) to authenticated;
grant execute on function public.editar_despesa_recorrente(uuid, text, numeric, text, uuid, date, boolean) to authenticated;
grant execute on function public.finalizar_despesa_recorrente(uuid) to authenticated;
grant execute on function public.gerar_minhas_ocorrencias() to authenticated;
