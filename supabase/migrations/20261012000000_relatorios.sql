
create view public.movimento_financeiro
with (security_invoker = true) as
select r.id, r.user_id, r.conta_id, 'receita'::text as tipo,
       r.data_recebimento as data, r.descricao, r.categoria,
       r.valor as valor, r.created_at
  from public.receita r
 where r.deleted_at is null
union all
select d.id, d.user_id, d.conta_id, 'despesa'::text,
       d.data_pagamento, d.descricao, d.categoria,
       -d.valor_pago, d.created_at
  from public.despesa d
 where d.deleted_at is null and d.status = 'paga';

revoke all on public.movimento_financeiro from anon, authenticated;
grant select on public.movimento_financeiro to authenticated;

create function public.extrato(
  p_de date,
  p_ate date,
  p_conta_id uuid default null,
  p_tipo text default 'todos',          -- todos | receitas | despesas
  p_ordem text default 'data',          -- data | categoria
  p_limit int default 100,
  p_offset int default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select m.id, m.tipo, m.data, m.descricao, m.categoria, m.valor,
           m.conta_id, c.nome as conta_nome, m.created_at
      from public.movimento_financeiro m
      join public.conta c on c.id = m.conta_id
     where m.data between p_de and p_ate
       and (p_conta_id is null or m.conta_id = p_conta_id)
       and (p_conta_id is not null or c.deleted_at is null)
       and (p_tipo = 'todos'
            or (p_tipo = 'receitas' and m.tipo = 'receita')
            or (p_tipo = 'despesas' and m.tipo = 'despesa'))
  ),
  tot as (
    select coalesce(sum(valor) filter (where valor > 0), 0) as entradas,
           coalesce(-sum(valor) filter (where valor < 0), 0) as saidas,
           coalesce(sum(valor), 0) as saldo_periodo,
           count(*) as quantidade
      from base
  )
  select jsonb_build_object(
    'periodo', jsonb_build_object('de', p_de, 'ate', p_ate),
    'saldo_atual', (
      select coalesce(sum(c.saldo_disponivel), 0)
        from public.conta c
       where (p_conta_id is null and c.deleted_at is null) or c.id = p_conta_id
    ),
    'totais', (select to_jsonb(tot) from tot),
    'itens', coalesce((
      select jsonb_agg(to_jsonb(x) - 'ord' order by x.ord)
        from (
          select b.*,
                 row_number() over (
                   order by case when p_ordem = 'categoria' then b.categoria end,
                            b.data, b.created_at, b.id
                 ) as ord
            from base b
        ) x
       where x.ord > p_offset and x.ord <= p_offset + p_limit
    ), '[]'::jsonb)
  );
$$;

create function public.relatorio_categorias(
  p_tipo text,
  p_de date,
  p_ate date,
  p_conta_id uuid default null
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select m.categoria, abs(m.valor) as valor
      from public.movimento_financeiro m
      join public.conta c on c.id = m.conta_id
     where m.tipo = case when p_tipo = 'receitas' then 'receita' else 'despesa' end
       and m.data between p_de and p_ate
       and (p_conta_id is null or m.conta_id = p_conta_id)
       and (p_conta_id is not null or c.deleted_at is null)
  ),
  tot as (
    select coalesce(sum(valor), 0) as total, count(*) as quantidade from base
  ),
  cat as (
    select categoria, sum(valor) as total, count(*) as quantidade
      from base group by categoria
  )
  select jsonb_build_object(
    'tipo', p_tipo,
    'periodo', jsonb_build_object('de', p_de, 'ate', p_ate),
    'total', (select total from tot),
    'quantidade', (select quantidade from tot),
    'categorias', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'categoria', cat.categoria,
                 'total', cat.total,
                 'quantidade', cat.quantidade,
                 'percentual', case when t.total = 0 then 0
                                    else round(cat.total * 100 / t.total, 2) end)
               order by cat.total desc, cat.categoria)
        from cat, tot t
    ), '[]'::jsonb),
    'a_pagar', case when p_tipo = 'despesas' then (
      select jsonb_build_object('total', coalesce(sum(d.valor), 0), 'quantidade', count(*))
        from public.despesa d
        join public.conta c on c.id = d.conta_id
       where d.status = 'pendente' and d.deleted_at is null
         and d.data_vencimento between p_de and p_ate
         and (p_conta_id is null or d.conta_id = p_conta_id)
         and (p_conta_id is not null or c.deleted_at is null)
    ) end
  );
$$;

create function public.dashboard(p_hoje date default null)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with p as (
    select coalesce(p_hoje, (now() at time zone 'America/Sao_Paulo')::date) as hoje
  ),
  contas as (
    select c.id, c.saldo_disponivel from public.conta c where c.deleted_at is null
  ),
  mov as (
    select m.* from public.movimento_financeiro m
     where m.conta_id in (select id from contas)
  ),
  e30 as (
    select coalesce(sum(m.valor), 0) as total, count(*) as quantidade
      from mov m, p
     where m.tipo = 'receita' and m.data between p.hoje - 29 and p.hoje
  ),
  s30 as (
    select coalesce(-sum(m.valor), 0) as total, count(*) as quantidade
      from mov m, p
     where m.tipo = 'despesa' and m.data between p.hoje - 29 and p.hoje
  ),
  mes as (
    select coalesce(sum(m.valor) filter (where m.tipo = 'receita'), 0) as receitas,
           coalesce(-sum(m.valor) filter (where m.tipo = 'despesa'), 0) as despesas
      from mov m, p
     where date_trunc('month', m.data) = date_trunc('month', p.hoje)
  ),
  pend as (
    select d.id, d.descricao, d.valor, d.categoria, d.data_vencimento
      from public.despesa d
     where d.status = 'pendente' and d.deleted_at is null
       and d.conta_id in (select id from contas)
  ),
  alertas as (
    select pe.id, pe.descricao, pe.valor, pe.data_vencimento,
           case when pe.data_vencimento < p.hoje then 'vencida'
                when pe.data_vencimento = p.hoje then 'hoje'
                else 'proxima' end as situacao
      from pend pe, p
     where pe.data_vencimento <= p.hoje + 7
     order by pe.data_vencimento, pe.id
     limit 10
  ),
  recentes as (
    select m.id, m.tipo, m.descricao, m.categoria, m.valor, m.data, m.created_at
      from mov m, p
     where m.data <= p.hoje
     order by m.data desc, m.created_at desc, m.id
     limit 8
  )
  select jsonb_build_object(
    'hoje', (select hoje from p),
    'saldo_total', (select coalesce(sum(saldo_disponivel), 0) from contas),
    'contas_ativas', (select count(*) from contas),
    'entradas_30d', (select to_jsonb(e30) from e30),
    'saidas_30d', (select to_jsonb(s30) from s30),
    'mes', (select to_jsonb(mes) from mes),
    'a_pagar', (select jsonb_build_object('total', coalesce(sum(valor), 0), 'quantidade', count(*)) from pend),
    'proximo_vencimento', (
      select to_jsonb(x) from (
        select pe.id, pe.descricao, pe.valor, pe.data_vencimento
          from pend pe, p
         where pe.data_vencimento >= p.hoje
         order by pe.data_vencimento, pe.id
         limit 1
      ) x
    ),
    'alertas', coalesce((select jsonb_agg(to_jsonb(a) order by a.data_vencimento, a.id) from alertas a), '[]'::jsonb),
    'movimentacoes_recentes', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.data desc, r.created_at desc, r.id) from recentes r
    ), '[]'::jsonb)
  );
$$;

-- ============ PERMISSÕES ============
revoke all on function public.extrato(date, date, uuid, text, text, int, int) from public, anon;
revoke all on function public.relatorio_categorias(text, date, date, uuid) from public, anon;
revoke all on function public.dashboard(date) from public, anon;

grant execute on function public.extrato(date, date, uuid, text, text, int, int) to authenticated;
grant execute on function public.relatorio_categorias(text, date, date, uuid) to authenticated;
grant execute on function public.dashboard(date) to authenticated;
