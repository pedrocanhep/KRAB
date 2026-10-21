
create table public.perfil (
  user_id uuid primary key references auth.users(id) on delete cascade,
  nome text not null check (char_length(btrim(nome)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.perfil enable row level security;
revoke all on public.perfil from anon, authenticated;
grant select on public.perfil to authenticated;

create policy perfil_select_own on public.perfil
  for select to authenticated using (user_id = auth.uid());

-- Salvar = criar na primeira vez e atualizar nas seguintes (repetir não duplica).
create function public.salvar_perfil(p_nome text)
returns public.perfil
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  p public.perfil;
begin
  if uid is null then raise exception 'nao_autenticado'; end if;

  insert into public.perfil (user_id, nome)
  values (uid, btrim(p_nome))
  on conflict (user_id)
  do update set nome = excluded.nome, updated_at = now()
  returning * into p;

  return p;
end;
$$;

revoke all on function public.salvar_perfil(text) from public, anon;
grant execute on function public.salvar_perfil(text) to authenticated;
