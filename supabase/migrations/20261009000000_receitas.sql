

create table public.conta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id),
  nome text not null check (char_length(btrim(nome)) between 1 and 50),
  saldo_disponivel numeric(14,2) not null default 0,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.receita (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  conta_id uuid not null references public.conta(id),
  descricao text not null check (char_length(btrim(descricao)) between 1 and 100),
  valor numeric(14,2) not null check (valor > 0),
  data_recebimento date not null,
  categoria text not null check (char_length(btrim(categoria)) between 1 and 50),
  deleted_at timestamptz,            -- exclusão lógica
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index receita_user_data_idx on public.receita (user_id, data_recebimento desc);
create index receita_conta_idx on public.receita (conta_id);


create table public.movimentacao_conta (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id),
  conta_id uuid not null references public.conta(id),
  origem_tipo text not null check (origem_tipo in ('receita', 'despesa', 'ajuste')),
  origem_id uuid not null,
  valor numeric(14,2) not null,      -- com sinal: + entra, - sai
  motivo text not null,
  created_at timestamptz not null default now()
);
create index mov_origem_idx on public.movimentacao_conta (origem_tipo, origem_id);
create index mov_conta_idx on public.movimentacao_conta (conta_id);

-
create table public.idempotencia (
  user_id uuid not null references auth.users(id),
  chave text not null,
  receita_id uuid not null references public.receita(id),
  created_at timestamptz not null default now(),
  primary key (user_id, chave)
);


alter table public.conta enable row level security;
alter table public.receita enable row level security;
alter table public.movimentacao_conta enable row level security;
alter table public.idempotencia enable row level security;

revoke all on public.conta, public.receita, public.movimentacao_conta, public.idempotencia
  from anon, authenticated;
grant select on public.conta, public.receita, public.movimentacao_conta to authenticated;

create policy conta_select_own on public.conta
  for select to authenticated using (user_id = auth.uid());
create policy receita_select_own on public.receita
  for select to authenticated using (user_id = auth.uid());
create policy mov_select_own on public.movimentacao_conta
  for select to authenticated using (user_id = auth.uid());

create function public.reconciliar_receita(p_id uuid, p_motivo text)
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
    insert into public.movimentacao_conta (user_id, conta_id, origem_tipo, origem_id, valor, motivo)
    values (r.user_id, r.conta_id, 'receita', p_id, alvo - atual, p_motivo);

    update public.conta
       set saldo_disponivel = saldo_disponivel + (alvo - atual)
     where id = r.conta_id;
  end if;
end;
$$;


create function public.criar_receita(
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

create function public.editar_receita(
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

create function public.excluir_receita(p_id uuid)
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

  perform 1 from public.conta where id = v_conta for update;
  select * into r from public.receita where id = p_id for update;

  if r.deleted_at is not null then return r; end if;                   -- já excluída: nada a fazer

  update public.receita set deleted_at = now(), updated_at = now()
   where id = p_id returning * into r;

  perform public.reconciliar_receita(p_id, 'exclusao');
  return r;
end;
$$;

create function public.restaurar_receita(p_id uuid)
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

  perform 1 from public.conta where id = v_conta for update;
  select * into r from public.receita where id = p_id for update;

  if r.deleted_at is null then return r; end if;                       -- já ativa: nada a fazer

  update public.receita set deleted_at = null, updated_at = now()
   where id = p_id returning * into r;

  perform public.reconciliar_receita(p_id, 'restauracao');
  return r;
end;
$$;

-- ============ PERMISSÕES DAS FUNÇÕES ============
revoke all on function public.reconciliar_receita(uuid, text) from public, anon, authenticated;

revoke all on function public.criar_receita(uuid, text, numeric, date, text, text) from public, anon;
revoke all on function public.editar_receita(uuid, text, numeric, date, text) from public, anon;
revoke all on function public.excluir_receita(uuid) from public, anon;
revoke all on function public.restaurar_receita(uuid) from public, anon;

grant execute on function public.criar_receita(uuid, text, numeric, date, text, text) to authenticated;
grant execute on function public.editar_receita(uuid, text, numeric, date, text) to authenticated;
grant execute on function public.excluir_receita(uuid) to authenticated;
grant execute on function public.restaurar_receita(uuid) to authenticated;
