# KRAB — Documento Oficial Direcional

## Keep Resources Always Balanced

**Documento oficial de contexto técnico, funcional e operacional do projeto**  
**Status:** documento vivo  
**Finalidade:** servir como fonte principal para desenvolvimento, manutenção e uso com IAs/agentes de código.  
**Base:** documentação acadêmica válida + decisões de desenvolvimento tomadas até outubro de 2026.

---

# 1. Visão geral do projeto

O **KRAB — Keep Resources Always Balanced** é um sistema web de gestão financeira voltado inicialmente para usuários leigos e pequenas empresas que não contam com consultoria financeira ou contábil especializada no dia a dia.

O problema de origem é um controle financeiro manual feito em planilhas de Excel, suscetível a:

- lançamentos esquecidos;
- registros duplicados;
- erros de digitação;
- dificuldade de leitura da situação financeira real do negócio;
- ausência de organização clara de receitas, despesas e contas.

A primeira versão do sistema deve substituir esse processo por uma aplicação simples, objetiva e intuitiva, com lançamento manual das movimentações, organização das contas e geração de informações financeiras básicas.

## Princípio de produto

O usuário não deve precisar conhecer termos contábeis complexos para utilizar funções básicas do sistema.

O KRAB deve priorizar:

- simplicidade;
- clareza de linguagem;
- baixa curva de aprendizado;
- boa manutenção do código;
- escopo controlado;
- aderência aos requisitos acadêmicos.

---

# 2. Contexto acadêmico

O projeto está sendo desenvolvido para a disciplina de **Estágio Supervisionado** do curso de Análise e Desenvolvimento de Sistemas.

A faculdade exige que o sistema contemple, no mínimo:

- **3 cadastros**;
- **1 movimento**;
- **3 relatórios**.

A modelagem definitiva desses itens ainda pode ser refinada durante o desenvolvimento. Nenhuma decisão técnica deve engessar prematuramente a interpretação acadêmica sem alinhamento entre desenvolvimento e documentação.

A primeira versão deve permanecer pequena, demonstrável e compatível com o prazo da faculdade.

---

# 3. Pessoas e responsabilidades

## Pedro

Responsável principalmente por:

- desenvolvimento da aplicação;
- frontend;
- arquitetura técnica;
- integração entre frontend e backend;
- versionamento;
- testes técnicos;
- manutenção geral do código.

## Larissa

Responsável principalmente por:

- documentação acadêmica;
- desenvolvimento de partes do backend;
- implementação e manutenção de rotas/API conforme divisão interna da dupla.

## Regra de sincronização

Qualquer mudança que afete:

- requisitos;
- banco de dados;
- payloads de API;
- fluxos;
- telas;
- regras de negócio;
- autenticação;
- relatórios;

precisa ser comunicada para que código e documentação não evoluam em direções diferentes.

---

# 4. Público-alvo

O sistema é pensado principalmente para:

- micro e pequenas empresas;
- gestores sem formação contábil;
- usuários que controlam entradas e saídas em planilhas ou processos manuais;
- pessoas que precisam visualizar rapidamente quanto possuem, quanto entrou, quanto saiu e onde o dinheiro está armazenado.

---

# 5. Objetivo funcional da primeira versão

A aplicação deverá permitir registrar e acompanhar movimentações financeiras básicas, mantendo saldo coerente e oferecendo relatórios simples para consulta.

Os requisitos funcionais atuais incluem:

## RF1 — Cadastrar receitas

Registrar entradas de dinheiro, incluindo ao menos:

- descrição;
- valor;
- data de recebimento;
- categoria;
- conta associada, quando aplicável ao contrato da API.

## RF2 — Cadastrar despesas

Registrar saídas financeiras e contas a pagar, incluindo ao menos:

- descrição;
- valor;
- vencimento ou data pertinente;
- categoria;
- conta associada, quando aplicável ao contrato da API.

## RF3 — Cadastrar contas bancárias e caixas

Registrar onde o dinheiro da empresa fica armazenado, por exemplo:

- conta corrente;
- caixa interno;
- poupança;
- outros meios equivalentes.

## RF4 — Gerar extratos

Exibir entradas e saídas em ordem cronológica, com possibilidade de consulta por período.

## RF5 — Gerar relatório de receitas

Apresentar as entradas financeiras do período de forma consolidada.

## RF6 — Gerar relatório de despesas

Apresentar os gastos do período de forma consolidada.

## RF7 — Processar saldo automaticamente

Sempre que uma receita ou despesa for incluída, alterada ou excluída, o sistema deve refletir corretamente a alteração no saldo relacionado.

---

# 6. Requisitos de negócio atuais

O sistema deve permitir:

- informar transações efetuadas;
- registrar e controlar receitas;
- registrar e controlar despesas;
- emitir extratos;
- emitir relatórios gerenciais;
- apresentar saldo final coerente.

---

# 7. Recursos adiados

Não são prioridade da primeira versão:

- importação automática de extratos via OFX/API bancária;
- integração direta com bancos;
- dashboards complexos e gráficos pesados;
- emissão e integração automática de notas fiscais;
- interação via WhatsApp;
- recursos de IA para leitura de imagens, contas, extratos ou automação de lançamentos;
- microserviços;
- filas ou mensageria;
- automações fiscais avançadas.

Esses recursos podem compor versões futuras, mas não devem bloquear a entrega acadêmica.

---

# 8. Stack tecnológica confirmada

## Frontend

- Vue.js
- TypeScript
- Vue Router
- Pinia
- Vite
- ESLint
- Prettier
- Oxlint

## Backend

- Node.js
- TypeScript
- Fastify
- Zod
- @fastify/cors

## Banco, autenticação e serviços de dados

- Supabase
- @supabase/supabase-js

## Ferramentas

- VS Code
- Git
- GitHub
- GitHub CLI (`gh`)
- Figma e/ou Lucid quando necessário
- Codex conectado diretamente à pasta do projeto

---

# 9. Arquitetura geral

O fluxo esperado da aplicação é:

```text
Usuário
  ↓
Frontend Vue.js
  ↓ HTTP/JSON
Backend Node.js + Fastify
  ↓
Supabase
```

## Regra principal

O frontend **não deve acessar diretamente o banco**.

O fluxo deve permanecer:

```text
Vue → API Node/Fastify → Supabase
```

---

# 10. Arquitetura MVC

O projeto deve seguir MVC de forma pragmática, especialmente no backend.

## Backend

Estrutura esperada:

```text
server/
└── src/
    ├── routes/
    ├── controllers/
    ├── services/
    ├── models/ ou camada equivalente
    ├── middlewares/
    ├── config/
    └── server.ts
```

### Responsabilidades

- **Routes:** definição das rotas HTTP.
- **Controllers:** recebem requisições e coordenam respostas.
- **Services:** regras reutilizáveis e lógica de negócio quando necessário.
- **Models / camada equivalente:** representação e acesso aos dados.

Não criar camadas vazias apenas para aparentar arquitetura.

## Frontend

No Vue, a organização deve respeitar as convenções naturais do framework:

```text
src/
├── components/
├── views/
├── router/
├── stores/
├── services/
├── types/
├── assets/
├── App.vue
└── main.ts
```

Interpretação aproximada:

- **View:** `views/` e `components/`;
- **Model:** `types/`, stores e estruturas de dados;
- **Controller / integração:** lógica das views, services e comunicação com API.

Não forçar MVC clássico de forma artificial no frontend.

---

# 11. Ambiente de desenvolvimento principal

## Máquina principal

- Lenovo IdeaPad 3i
- 8 GB de RAM
- SSD de 256 GB
- Linux Mint

## Ferramentas verificadas

- Node.js: v24.21.0
- npm: 11.19.0
- NVM: 0.40.3
- Git: 2.43.0
- GitHub CLI: 2.45.0
- curl: 8.5.0

## Diretório local oficial

```text
/home/pedro/Documentos/faculdade/estagio_supervisionado/KRAB
```

---

# 12. Repositório e Git

O repositório remoto oficial é privado no GitHub.

## Branches

- `main`: versão principal/estável
- `dev`: desenvolvimento ativo

## Regra de trabalho

Trabalhar normalmente na `dev`.

Fluxo recomendado:

```bash
git switch dev
git pull
```

Após alterações:

```bash
git status
git add .
git commit -m "feat: descrição da alteração"
git push
```

Quando uma versão estiver estável, a `dev` pode ser integrada à `main`.

## Regras

- não trabalhar diretamente na `main` para alterações comuns;
- evitar editar simultaneamente os mesmos arquivos quando possível;
- antes de mudanças estruturais, criar commit estável;
- não reescrever histórico sem necessidade;
- sempre verificar `git status` antes de operações importantes.

---

# 13. Estado atual do frontend

O frontend Vue já foi criado e está funcional.

## Estrutura atual relevante

```text
src/
├── router/
│   └── index.ts
├── stores/
├── views/
│   ├── HomeView.vue
│   └── DespesasView.vue
├── App.vue
└── main.ts
```

## Router atual

A Home está registrada na rota `/`.

A tela de despesas está registrada em `/despesas`.

## App.vue

O `App.vue` atua como raiz da aplicação e renderiza o `RouterView`.

---

# 14. Cadastro de despesas — estado atual

A tela inicial de cadastro de despesas já existe em:

```text
src/views/DespesasView.vue
```

Campos atuais:

- descrição;
- valor;
- vencimento;
- categoria.

O formulário utiliza:

- `ref`;
- `v-model`;
- `v-model.number` para valor;
- `@submit.prevent`.

Existe uma função `cadastrarDespesa()` usada inicialmente para validar os dados do formulário via `console.log`.

## Regra de integração futura

Quando conectar ao backend:

- validar campos obrigatórios;
- enviar payload conforme contrato real da API;
- mostrar erro compreensível;
- limpar formulário somente após sucesso;
- preservar os dados digitados em caso de falha.

---

# 15. Cadastro de receitas — contrato observado

O backend já possui implementação de cadastro de receitas.

Contrato observado até o momento:

```text
POST /receitas
```

Headers esperados:

```text
Authorization: Bearer <token>
Content-Type: application/json
```

Payload observado:

```json
{
  "conta_id": "...",
  "descricao": "Salário",
  "valor": 1200.00,
  "data_recebimento": "2026-10-09",
  "categoria": "Salário"
}
```

A resposta retorna a receita criada com campos persistidos.

## Regra

Antes de criar ou alterar a tela de receitas, verificar o contrato atual diretamente no backend.

A implementação real do código deve prevalecer sobre suposições antigas.

---

# 16. Backend atual

O backend está localizado em:

```text
server/
```

## package.json atual

Scripts existentes:

```text
npm run dev
npm start
npm test
npm run type-check
```

## Porta padrão

```text
3333
```

## CORS

Frontend local esperado:

```text
http://localhost:5173
```

Backend local esperado:

```text
http://localhost:3333
```

---

# 17. Variáveis de ambiente do backend

O backend possui `.env.example` com variáveis como:

```text
SUPABASE_URL=
SUPABASE_ANON_KEY=
PORT=3333
CORS_ORIGIN=http://localhost:5173
```

## Regras de segurança

- `.env` real não deve ser commitado;
- nunca expor chaves ou tokens em respostas, prints ou código versionado;
- nunca usar `service_role` no frontend;
- utilizar HTTPS em produção;
- validar autenticação no backend;
- restringir cada usuário aos próprios dados.

---

# 18. Supabase

Supabase é a decisão atual para:

- persistência de dados;
- autenticação;
- integração de dados do projeto.

A camada de API Node/Fastify continua sendo obrigatória entre Vue e Supabase.

O frontend não deve consumir diretamente o banco para operações de negócio.

---

# 19. Modelo de dados inicial — direção atual

A modelagem definitiva ainda pode evoluir.

## Usuário

Possíveis campos:

- id;
- nome;
- e-mail;
- dados de autenticação gerenciados pelo Supabase;
- data de criação.

## Conta financeira

Representa onde o dinheiro está armazenado.

Possíveis campos:

- id;
- nome;
- tipo;
- saldo inicial;
- status;
- usuário proprietário.

## Categoria

Pode classificar receitas e despesas.

Possíveis campos:

- id;
- nome;
- tipo;
- usuário proprietário.

## Movimentação

Modelo conceitual central possível para receitas e despesas.

Possíveis campos:

- id;
- descrição;
- valor;
- tipo;
- data;
- conta;
- categoria;
- observação;
- data de criação.

A decisão final entre entidade única de movimentação ou entidades separadas ainda deve respeitar simplicidade, documentação e implementação real do backend.

---

# 20. Relatórios mínimos esperados

## Extrato financeiro

- entradas e saídas;
- ordem cronológica;
- filtro por período;
- saldo ou efeito das movimentações.

## Relatório de receitas

- receitas do período;
- total de receitas;
- agrupamento por categoria quando aplicável.

## Relatório de despesas

- despesas do período;
- total de despesas;
- agrupamento por categoria quando aplicável.

A apresentação inicial pode ser textual ou tabular.

Gráficos complexos não são necessários para o MVP acadêmico.

---

# 21. Diretrizes de UX/UI

O sistema é feito para usuários leigos.

Priorizar:

- linguagem cotidiana;
- formulários curtos;
- ações principais evidentes;
- navegação previsível;
- mensagens de erro claras;
- boa leitura em desktop e dispositivos menores;
- valores monetários formatados corretamente;
- baixo ruído visual;
- informações essenciais sem depender de gráficos.

## Tela inicial

A Home deve responder rapidamente a perguntas como:

- quanto dinheiro tenho disponível?;
- quanto entrou?;
- quanto saiu?;
- quais foram as movimentações recentes?;
- existe algo importante que exige atenção?

---

# 22. Referência visual oficial

O protótipo principal da Home está em:

```text
docs/prototipos/home-dashboard.jpeg
```

Essa imagem deve ser utilizada como referência visual para o desenvolvimento da tela inicial.

O protótipo não deve ser copiado cegamente. A implementação deve preservar:

- simplicidade;
- legibilidade;
- responsividade;
- coerência com o escopo acadêmico.

---

# 23. Documento oficial no repositório

A versão editável humana está em:

```text
docs/KRAB_DOCUMENTO_OFICIAL_DIRECIONAL.docx
```

A versão principal para agentes de código e IAs deve ser:

```text
docs/KRAB_DOCUMENTO_OFICIAL_DIRECIONAL.md
```

Quando houver conflito entre contexto antigo e este documento atualizado, a versão mais recente deste documento deve prevalecer, salvo decisão explícita do usuário.

---

# 24. AGENTS.md e Codex

O projeto utiliza arquivos `AGENTS.md` para orientar agentes de código.

Estrutura recomendada:

```text
AGENTS.md
src/AGENTS.md
server/AGENTS.md
```

## AGENTS.md raiz

Define:

- regras gerais de trabalho;
- comportamento esperado do agente;
- regras de Git;
- princípios de escopo;
- referência aos documentos oficiais.

## src/AGENTS.md

Define regras específicas do frontend Vue.

## server/AGENTS.md

Define regras específicas do backend Node/Fastify/Supabase.

## Regra central para agentes

Antes de mudanças relevantes:

1. ler o `AGENTS.md` aplicável;
2. consultar este documento oficial;
3. inspecionar o código real;
4. não inventar contratos quando puder verificar;
5. perguntar antes de decisões estruturais importantes.

---

# 25. Qualidade mínima de código

## Frontend

- usar TypeScript de forma coerente;
- evitar `any` sem necessidade;
- usar `<script setup lang="ts">`;
- evitar `App.vue` gigante;
- não espalhar `fetch()` aleatoriamente pelos componentes;
- usar `services/` para integração com API quando fizer sentido;
- usar Pinia somente para estado realmente compartilhado;
- criar componentes quando houver motivo real.

## Backend

- validar entrada;
- usar Zod quando apropriado;
- retornar status HTTP coerentes;
- não colocar lógica excessiva diretamente nas rotas;
- não alterar contratos da API silenciosamente;
- manter autenticação e autorização no backend.

---

# 26. Valores financeiros

Mesmo em uma aplicação simples, algumas regras devem ser preservadas:

- evitar cálculos críticos apenas no frontend;
- não alterar valores silenciosamente;
- edição ou exclusão deve refletir corretamente no saldo;
- saldo deve seguir uma regra única e confiável;
- datas devem ser tratadas de forma consistente;
- valores monetários devem evitar erros de ponto flutuante.

A estratégia técnica exata deve ser compatível com Supabase e backend.

---

# 27. Testes

Testes automatizados não são prioridade imediata do frontend, mas o backend já possui estrutura de testes.

Inicialmente devem ser realizados:

- testes manuais de fluxo;
- testes de formulário;
- testes isolados das rotas da API;
- payload válido;
- payload inválido;
- autenticação;
- códigos HTTP;
- persistência;
- cenários de inclusão, edição e exclusão;
- cálculos financeiros.

---

# 28. Estratégia de desenvolvimento

O projeto deve continuar incremental.

Ordem geral recomendada:

1. manter ambiente e Git estáveis;
2. consolidar contexto do projeto para a dupla e para agentes;
3. finalizar contratos básicos da API;
4. validar backend isoladamente;
5. criar telas Vue simples;
6. conectar Vue ao backend;
7. implementar cadastros obrigatórios;
8. implementar movimentação financeira;
9. implementar saldo;
10. implementar três relatórios;
11. revisar UX/UI;
12. validar requisitos acadêmicos;
13. alinhar versão final com a documentação.

---

# 29. Filosofia de escopo

## Fazer agora

- funcionalidades obrigatórias;
- navegação clara;
- cadastros;
- movimentações;
- persistência;
- autenticação necessária;
- saldo;
- relatórios mínimos;
- integração frontend/backend.

## Evitar agora

- microserviços;
- arquitetura distribuída;
- mensageria;
- dashboards pesados;
- IA;
- integração bancária;
- automações fiscais;
- abstrações excessivas;
- otimizações prematuras.

---

# 30. Pontos ainda em aberto

Não tratar como decisões definitivas sem alinhamento:

1. definição final dos 3 cadastros acadêmicos;
2. definição final do movimento acadêmico;
3. modelagem definitiva das entidades;
4. entidade única de movimentação versus receitas/despesas separadas;
5. regras finais de categorias;
6. regras finais de contas recorrentes;
7. formato final dos relatórios;
8. estratégia final de deploy/hospedagem;
9. refinamentos finais de identidade visual;
10. política final de saldo e consistência financeira.

---

# 31. Fonte documental válida

Para requisitos acadêmicos, considerar como base principal a documentação válida do KRAB e este documento oficial atualizado.

Conteúdos antigos de documentação que sejam claramente exemplos de outros sistemas não devem ser usados como requisito do KRAB.

---

# 32. Instruções para IAs e agentes de código

Ao utilizar este documento como contexto:

1. tratar este arquivo como fonte principal do estado atual do projeto;
2. não inventar decisões nos pontos pendentes;
3. perguntar antes de decisões de arquitetura com impacto relevante;
4. priorizar soluções simples;
5. não adicionar tecnologias sem necessidade;
6. considerar Linux Mint como ambiente principal de Pedro;
7. considerar macOS como ambiente possível da Larissa;
8. trabalhar passo a passo;
9. distinguir requisito confirmado, proposta técnica e decisão pendente;
10. manter frontend, backend, banco e documentação coerentes;
11. não expandir o MVP sem pedido explícito;
12. antes de grandes mudanças, verificar Git e recomendar commit de segurança;
13. nunca incluir segredos em código versionado;
14. inspecionar o código real antes de sugerir contratos ou payloads;
15. explicar conceitos quando o usuário estiver aprendendo a tecnologia;
16. não alterar arquivos não relacionados à tarefa;
17. respeitar os `AGENTS.md` aplicáveis.

---

# 33. Estado atual resumido

No ponto atual:

- projeto Vue criado e funcionando;
- Router configurado;
- Home criada;
- tela inicial de despesas criada;
- GitHub privado configurado;
- branches `main` e `dev` configuradas;
- desenvolvimento ativo em `dev`;
- backend Node/Fastify criado em `server/`;
- Supabase definido como banco/autenticação;
- rota de receitas já existe no backend;
- integração de receitas com frontend ainda precisa ser feita;
- integração de despesas com backend ainda precisa ser feita;
- Codex conectado diretamente à pasta do projeto;
- estrutura de `AGENTS.md` sendo configurada;
- protótipo oficial da Home salvo em `docs/prototipos/home-dashboard.jpeg`;
- documento oficial disponível em `.docx` e agora também em `.md`.

---

# 34. Próximos passos imediatos

1. finalizar configuração dos `AGENTS.md`;
2. validar que o Codex entendeu o contexto do projeto;
3. configurar o backend local (`server/.env`);
4. instalar dependências do backend;
5. iniciar API local;
6. testar `POST /receitas` isoladamente;
7. criar `ReceitasView.vue`;
8. registrar rota `/receitas`;
9. conectar formulário Vue ao backend;
10. repetir o processo para despesas;
11. avançar gradualmente para contas e relatórios.

---

# 35. Regra de manutenção deste documento

Este é um documento vivo.

Sempre que uma decisão estrutural for tomada, revisar pelo menos uma destas áreas:

- requisitos;
- stack;
- arquitetura;
- modelo de dados;
- contratos de API;
- autenticação;
- estado do repositório;
- decisões pendentes;
- próximos passos;
- referências visuais;
- ferramentas de IA/agentes.

Quando houver conflito entre um chat antigo e este documento atualizado, a versão mais recente deste documento deve prevalecer, salvo indicação explícita do usuário.

---

**Fim do Documento Oficial Direcional — KRAB**
