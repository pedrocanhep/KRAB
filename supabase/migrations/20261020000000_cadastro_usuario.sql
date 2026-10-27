-- KRAB — Cadastro de usuário: cria o PERFIL (nome) automaticamente quando um usuário nasce.
-- O e-mail e a senha ficam no Supabase Auth (auth.users); a API de cadastro envia o nome como
-- metadado e este gatilho o copia para a tabela perfil. Rodar UMA vez, depois da migration do perfil.
--
-- O gatilho NUNCA pode impedir um cadastro: se o nome vier ausente, em branco, longo demais, ou se
-- qualquer coisa falhar, o usuário é criado normalmente e apenas fica sem perfil (a pessoa pode
-- salvar o nome depois, com PUT /perfil). Usuários criados no painel do Supabase continuam funcionando.

create function public.criar_perfil_do_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nome text := btrim(coalesce(new.raw_user_meta_data ->> 'nome', ''));
begin
  if char_length(v_nome) between 1 and 80 then
    insert into public.perfil (user_id, nome)
    values (new.id, v_nome)
    on conflict (user_id) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'KRAB: perfil não criado para o usuário %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke all on function public.criar_perfil_do_usuario() from public, anon, authenticated;

create trigger krab_criar_perfil_apos_cadastro
  after insert on auth.users
  for each row execute function public.criar_perfil_do_usuario();

-- Para desfazer, se um dia precisar:
--   drop trigger krab_criar_perfil_apos_cadastro on auth.users;
--   drop function public.criar_perfil_do_usuario();
