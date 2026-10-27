-- Teste do gatilho que cria o perfil junto com o usuário. Não deixa nada gravado: ao final levanta
-- uma exceção de propósito, que desfaz TUDO (inclusive os usuários de teste inseridos aqui).
--   * Se passar:  aparece um "erro" começando com  OK: ...
--   * Se falhar:  aparece a mensagem do cenário que falhou.
do $$
declare
  a uuid := gen_random_uuid(); b uuid := gen_random_uuid(); c uuid := gen_random_uuid();
  d uuid := gen_random_uuid(); e uuid := gen_random_uuid();
  v text; n int;
begin
  -- 1) nome válido nos metadados: perfil criado
  insert into auth.users (id, email, raw_user_meta_data)
  values (a, 'teste-' || a || '@krab.invalid', jsonb_build_object('nome', 'Fulana'));
  select nome into v from public.perfil where user_id = a;
  assert v = 'Fulana', '1: perfil deveria ter sido criado com o nome Fulana, veio [' || coalesce(v, 'nulo') || ']';

  -- 2) espaços nas pontas são removidos
  insert into auth.users (id, email, raw_user_meta_data)
  values (b, 'teste-' || b || '@krab.invalid', jsonb_build_object('nome', '   Beltrana   '));
  select nome into v from public.perfil where user_id = b;
  assert v = 'Beltrana', '2: espaços deveriam ser removidos, veio [' || coalesce(v, 'nulo') || ']';

  -- 3) sem nome (como um usuário criado no painel): usuário criado, sem perfil, sem erro
  insert into auth.users (id, email, raw_user_meta_data)
  values (c, 'teste-' || c || '@krab.invalid', '{}'::jsonb);
  select count(*) into n from auth.users where id = c;
  assert n = 1, '3a: o usuário sem nome deveria ter sido criado';
  select count(*) into n from public.perfil where user_id = c;
  assert n = 0, '3b: sem nome não deveria existir perfil';

  -- 4) nome em branco: usuário criado, sem perfil
  insert into auth.users (id, email, raw_user_meta_data)
  values (d, 'teste-' || d || '@krab.invalid', jsonb_build_object('nome', '     '));
  select count(*) into n from public.perfil where user_id = d;
  assert n = 0, '4: nome em branco não deveria criar perfil';

  -- 5) nome com mais de 80 caracteres: usuário criado, sem perfil (o cadastro nunca falha por causa do nome)
  insert into auth.users (id, email, raw_user_meta_data)
  values (e, 'teste-' || e || '@krab.invalid', jsonb_build_object('nome', repeat('a', 81)));
  select count(*) into n from auth.users where id = e;
  assert n = 1, '5a: o usuário deveria ter sido criado mesmo com nome longo';
  select count(*) into n from public.perfil where user_id = e;
  assert n = 0, '5b: nome longo não deveria criar perfil';

  raise exception 'OK: todos os cenários do cadastro de usuário passaram (alterações revertidas de propósito)';
end $$;
