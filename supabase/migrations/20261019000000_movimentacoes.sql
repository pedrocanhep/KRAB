-- KRAB — Movimentações: consulta do histórico de saldo (o ledger) com descrição e saldo após cada linha.
-- SOMENTE LEITURA: nada aqui altera saldo ou dados. Rodar UMA vez.
--
-- Cada linha é um evento que mexeu no saldo de uma conta: saldo inicial, receita lançada,
-- despesa paga, ajuste de valor, estorno por exclusão e reaplicação por restauração.
-- Roda como o USUÁRIO (security invoker), então o RLS já limita aos dados dele.
-- Contas excluídas ficam de fora, salvo se o usuário pedir aquela conta (conta_id).

create function public.movimentacoes(
  p_conta_id uuid default null,
  p_de date default null,              -- filtra pela DATA do evento (fuso de São Paulo)
  p_ate date default null,
  p_origem text default 'todas',       -- todas | receita | despesa | ajuste
  p_limit int default 50,
  p_offset int default 0
)
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  with base as (
    select m.id, m.conta_id, c.nome as conta_nome, c.deleted_at as conta_excluida_em,
           m.origem_tipo, m.origem_id,
           case m.origem_tipo
             when 'receita' then r.descricao
             when 'despesa' then d.descricao
             else 'Saldo inicial'
           end as descricao,
           case m.origem_tipo
             when 'receita' then r.categoria
             when 'despesa' then d.categoria
             else null
           end as categoria,
           m.motivo,
           case
             when m.motivo = 'saldo_inicial' then 'Saldo inicial'
             when m.origem_tipo = 'receita' and m.motivo = 'criacao' then 'Receita lançada'
             when m.origem_tipo = 'despesa' and m.motivo = 'pagamento' then 'Despesa paga'
             when m.motivo = 'edicao' then 'Valor ajustado'
             when m.motivo = 'exclusao' then 'Estorno (excluída)'
             when m.motivo = 'restauracao' then 'Reaplicada (restaurada)'
             else m.motivo
           end as rotulo,
           m.valor,
           -- saldo da conta logo depois deste evento (o saldo é sempre a soma do ledger)
           sum(m.valor) over (partition by m.conta_id order by m.id) as saldo_apos,
           m.created_at
      from public.movimentacao_conta m
      join public.conta c on c.id = m.conta_id
      left join public.receita r on m.origem_tipo = 'receita' and r.id = m.origem_id
      left join public.despesa d on m.origem_tipo = 'despesa' and d.id = m.origem_id
  ),
  filtrado as (
    select b.*
      from base b
     where (p_conta_id is null or b.conta_id = p_conta_id)
       and (p_conta_id is not null or b.conta_excluida_em is null)
       and (p_origem = 'todas' or b.origem_tipo = p_origem)
       and (p_de is null or (b.created_at at time zone 'America/Sao_Paulo')::date >= p_de)
       and (p_ate is null or (b.created_at at time zone 'America/Sao_Paulo')::date <= p_ate)
  )
  select jsonb_build_object(
    'total', (select count(*) from filtrado),
    'itens', coalesce((
      select jsonb_agg(to_jsonb(x) - 'conta_excluida_em' - 'ord' order by x.ord)
        from (
          select f.*, row_number() over (order by f.id desc) as ord
            from filtrado f
        ) x
       where x.ord > p_offset and x.ord <= p_offset + p_limit
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.movimentacoes(uuid, date, date, text, int, int) from public, anon;
grant execute on function public.movimentacoes(uuid, date, date, text, int, int) to authenticated;
