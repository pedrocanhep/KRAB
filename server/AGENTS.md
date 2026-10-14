````md
# KRAB — Instruções do Backend

Este diretório contém o backend Node.js do KRAB.

## Stack atual

- Node.js
- TypeScript
- Fastify
- Zod
- Supabase
- @fastify/cors

## Arquitetura

O backend deve seguir MVC de forma pragmática.

Separação esperada:

- `routes/`: definição das rotas
- `controllers/`: entrada HTTP e resposta
- `services/`: regras reutilizáveis
- `models/` ou camada equivalente: representação/acesso a dados quando necessário

Não criar camadas artificiais sem função real.

## Fluxo principal

Vue
→ HTTP
→ Fastify
→ Controller
→ Regra de negócio
→ Supabase
→ resposta JSON

## Fastify

As rotas devem:

- validar entrada;
- retornar códigos HTTP apropriados;
- evitar lógica excessiva diretamente no handler quando ela crescer;
- produzir mensagens de erro compreensíveis.

## Zod

Usar Zod para validação de payload quando já estiver adotado naquela área.

Não duplicar validações sem necessidade.

Validação crítica deve existir no backend mesmo que o frontend também valide.

## Supabase

Supabase é a camada atual de dados e autenticação.

Nunca:

- expor `service_role`;
- colocar segredo no código;
- commitar `.env`;
- imprimir tokens completos;
- confiar somente no frontend para autorização.

Utilizar:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- outras variáveis somente quando realmente necessárias.

## Autenticação

Quando uma rota exigir usuário autenticado:

- verificar `Authorization: Bearer <token>`;
- validar o token;
- impedir acesso aos dados de outro usuário.

Antes de alterar estratégia de autenticação, perguntar ao usuário.

## API

A API é a fonte do contrato para o frontend.

Ao alterar:

- nome de campo;
- payload;
- rota;
- formato da resposta;
- autenticação;
- status HTTP;

considerar impacto no frontend.

Não alterar contratos existentes silenciosamente.

## Receitas

Antes de modificar receitas, verificar a implementação atual.

Campos observados no projeto incluem:

- `conta_id`
- `descricao`
- `valor`
- `data_recebimento`
- `categoria`

Usar o código real como fonte de verdade.

## Despesas

O cadastro de despesas deve permanecer coerente com a documentação e com o frontend.

Campos atualmente esperados incluem:

- descrição
- valor
- vencimento
- categoria

Não definir contrato definitivo sem verificar a implementação existente.

## Valores financeiros

Evitar comportamento inseguro com ponto flutuante.

Não permitir:

- valores inválidos;
- valores silenciosamente transformados;
- saldo calculado com regras divergentes em lugares diferentes.

A regra financeira confiável deve residir no backend/banco.

## CORS

Durante desenvolvimento, o frontend normalmente roda em:

```text
http://localhost:5173
```
````

e o backend em:
http://localhost:3333

Respeitar CORS_ORIGIN do ambiente.
Testes
Antes de concluir alteração em rota:

- iniciar servidor;
- testar rota isoladamente;
- testar payload válido;
- testar payload inválido;
- verificar status HTTP;
- verificar resposta;
- verificar persistência quando aplicável.
  Git
  Não fazer:
- merge;
- push;
- rebase;
- reset destrutivo;
- alteração de histórico
  sem solicitação explícita.
  Antes de mudança grande, verificar branch e git status.

Depois confira:

```bash
find . -name "AGENTS.md" -print
```
