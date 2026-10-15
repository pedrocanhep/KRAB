-- KRAB — Contas (bancos, poupanças e caixas): cadastro completo.
-- Estende a tabela conta (criada na migration de receitas) e cria as funções da API.
-- Rodar UMA vez, depois das migrations de receitas e despesas.
--
-- ATENÇÃO: se você criou mais de uma conta com o MESMO nome, o índice único abaixo falha.
-- Nesse caso, renomeie uma delas antes (update public.conta set nome = 'Outro nome' where id = '...').

-- ============ NOVAS COLUNAS ============

alter table public.conta
  add column tipo text not null default 'corrente'
    check (tipo in ('corrente', 'poupanca', 'caixa', 'outro')),
  add column cod_banco text check (cod_banco ~ '^[0-9]{1,4}$'),
  add column agencia text check (agencia ~ '^[0-9]{1,5}$'),
  add column num_conta text check (num_conta ~ '^[0-9]{1,15}$'),
  add column digito_verificador text check (digito_verificador ~ '^[0-9A-Za-z]{1,2}$'),
  add column updated_at timestamptz not null default now();

-- Um usuário não pode ter duas contas ATIVAS com o mesmo nome (ignora maiúsculas e espaços nas pontas).
create unique index conta_nome_unico_idx
  on public.conta (user_id, lower(btrim(nome)))
  where deleted_at is null;

-- ============ FUNÇÕES PÚBLICAS (chamadas pela API) ============
-- O saldo NUNCA é alterado direto: só nasce no saldo inicial (registrado no ledger como 'ajuste')
-- e depois muda pelas receitas e despesas pagas.

create function public.criar_conta(
  p_nome text,
  p_tipo text default 'corrente',
  p_saldo_inicial numeric default 0,
  p_cod_banco text default null,
  p_agencia text default null,
  p_num_conta text default null,
  p_digito text default null
)
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

  begin
    insert into public.conta
      (user_id, nome, tipo, saldo_disponivel, cod_banco, agencia, num_conta, digito_verificador)
    values
      (uid, btrim(p_nome), p_tipo, coalesce(p_saldo_inicial, 0),
       nullif(btrim(p_cod_banco), ''), nullif(btrim(p_agencia), ''),
       nullif(btrim(p_num_conta), ''), nullif(btrim(p_digito), ''))
    returning * into c;
  exception when unique_violation then
    raise exception 'nome_ja_existe';
  end;

  if c.saldo_disponivel <> 0 then
    insert into public.movimentacao_conta (user_id, conta_id, origem_tipo, origem_id, valor, motivo)
    values (uid, c.id, 'ajuste', c.id, c.saldo_disponivel, 'saldo_inicial');
  end if;

  return c;
end;
$$;

-- Editar: só dados cadastrais. Campo bancário enviado como '' (vazio) é LIMPO; null = não mexe.
create function public.editar_conta(
  p_id uuid,
  p_nome text default null,
  p_tipo text default null,
  p_cod_banco text default null,
  p_agencia text default null,
  p_num_conta text default null,
  p_digito text default null
)
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
  if c.deleted_at is not null then raise exception 'estado_invalido'; end if;

  begin
    update public.conta
       set nome = coalesce(btrim(p_nome), nome),
           tipo = coalesce(p_tipo, tipo),
           cod_banco = case when p_cod_banco is null then cod_banco else nullif(btrim(p_cod_banco), '') end,
           agencia = case when p_agencia is null then agencia else nullif(btrim(p_agencia), '') end,
           num_conta = case when p_num_conta is null then num_conta else nullif(btrim(p_num_conta), '') end,
           digito_verificador = case when p_digito is null then digito_verificador else nullif(btrim(p_digito), '') end,
           updated_at = now()
     where id = p_id
     returning * into c;
  exception when unique_violation then
    raise exception 'nome_ja_existe';
  end;

  return c;
end;
$$;

-- Excluir (lógico): bloqueado se houver despesa PENDENTE ativa (pagá-la depois cairia numa conta excluída).
-- O saldo e o histórico ficam preservados. Repetir não faz nada.
create function public.excluir_conta(p_id uuid)
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

  update public.conta set deleted_at = now(), updated_at = now()
   where id = p_id returning * into c;
  return c;
end;
$$;

-- Restaurar: falha se já existir outra conta ativa com o mesmo nome. Repetir não faz nada.
create function public.restaurar_conta(p_id uuid)
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
  if c.deleted_at is null then return c; end if;

  begin
    update public.conta set deleted_at = null, updated_at = now()
     where id = p_id returning * into c;
  exception when unique_violation then
    raise exception 'nome_ja_existe';
  end;

  return c;
end;
$$;

-- ============ PERMISSÕES ============
revoke all on function public.criar_conta(text, text, numeric, text, text, text, text) from public, anon;
revoke all on function public.editar_conta(uuid, text, text, text, text, text, text) from public, anon;
revoke all on function public.excluir_conta(uuid) from public, anon;
revoke all on function public.restaurar_conta(uuid) from public, anon;

grant execute on function public.criar_conta(text, text, numeric, text, text, text, text) to authenticated;
grant execute on function public.editar_conta(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.excluir_conta(uuid) to authenticated;
grant execute on function public.restaurar_conta(uuid) to authenticated;
