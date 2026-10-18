-- TEMPORÁRIO: soma geral para validar a integração durante o desenvolvimento.
-- TODO: substituir na interface pela regra financeira oficial por contas,
-- status e saldo real. Esta função não altera nenhuma regra financeira.
create function public.resumo_desenvolvimento()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with totais as (
    select
      (select coalesce(sum(r.valor), 0)
         from public.receita r where r.deleted_at is null) as entradas,
      (select coalesce(sum(d.valor), 0)
         from public.despesa d where d.deleted_at is null) as saidas
  )
  select jsonb_build_object(
    'entradas', entradas,
    'saidas', saidas,
    'saldo', entradas - saidas
  ) from totais;
$$;

-- SECURITY INVOKER preserva as políticas SELECT existentes para auth.uid().
-- Sem acesso anônimo, sem SECURITY DEFINER e sem permissão administrativa.
revoke all on function public.resumo_desenvolvimento() from public, anon;
grant execute on function public.resumo_desenvolvimento() to authenticated;
