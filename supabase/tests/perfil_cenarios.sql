
do $$
declare
  u uuid := '74a9bd78-fcb3-4274-a2f4-27322939be7f';  -- UID do seu usuário de teste
  p public.perfil; n int; criado timestamptz;
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', u, 'role', 'authenticated')::text, true);

  -- 1) primeira vez: cria
  p := public.salvar_perfil('Larissa');
  assert p.nome = 'Larissa' and p.user_id = u, '1: perfil deveria ser criado com o nome Larissa';
  criado := p.created_at;

  -- 2) salvar de novo atualiza a MESMA linha (não duplica)
  p := public.salvar_perfil('Larissa Pereira');
  select count(*) into n from public.perfil where user_id = u;
  assert n = 1, '2a: deveria existir 1 perfil, existem ' || n;
  assert p.nome = 'Larissa Pereira' and p.created_at = criado, '2b: nome deveria ter sido atualizado';

  -- 3) espaços nas pontas são removidos
  p := public.salvar_perfil('   Ana   ');
  assert p.nome = 'Ana', '3: espaços deveriam ser removidos, ficou [' || p.nome || ']';

  -- 4) nome em branco é recusado pelo banco (check = 23514)
  begin
    perform public.salvar_perfil('    ');
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlstate = '23514', '4: esperado 23514, veio ' || sqlstate || ' ' || sqlerrm;
  end;

  -- 5) nome com mais de 80 caracteres é recusado
  begin
    perform public.salvar_perfil(repeat('a', 81));
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlstate = '23514', '5: esperado 23514, veio ' || sqlstate || ' ' || sqlerrm;
  end;

  -- 6) sem usuário autenticado, a função recusa
  perform set_config('request.jwt.claims', '{}', true);
  begin
    perform public.salvar_perfil('Fulano');
    assert false, 'deveria ter falhado';
  exception when others then
    assert sqlerrm like '%nao_autenticado%', '6: erro inesperado: ' || sqlerrm;
  end;

  raise exception 'OK: todos os cenários de perfil passaram (alterações revertidas de propósito)';
end $$;
