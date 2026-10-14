# KRAB — Instruções para Agentes de Código

## Contexto do projeto

KRAB — Keep Resources Always Balanced é um sistema web de gestão financeira para usuários leigos e pequenas empresas.

O projeto nasceu para a disciplina de Estágio Supervisionado e deve permanecer simples, funcional e compatível com o escopo acadêmico.

O frontend usa Vue.js + TypeScript.
O backend usa Node.js + Fastify.
A persistência e autenticação utilizam Supabase.

Antes de decisões estruturais, consulte a documentação oficial do projeto, quando disponível em:

`docs/KRAB_DOCUMENTO_OFICIAL_DIRECIONAL.md`

A documentação oficial prevalece sobre suposições feitas pelo agente.

---

## Forma de trabalho

O usuário está aprendendo Vue.js e desenvolvimento full stack durante a construção deste projeto.

Por isso:

- não faça mudanças grandes silenciosamente;
- explique brevemente o que será alterado antes de alterações relevantes;
- para mudanças pequenas e óbvias, execute diretamente;
- para decisões de arquitetura, banco, autenticação ou organização estrutural, pergunte antes;
- trabalhe passo a passo;
- não implemente funcionalidades não solicitadas;
- não aumente o escopo do MVP por iniciativa própria.

O objetivo não é apenas gerar código. O usuário precisa entender a manutenção básica do que está sendo criado.

---

## Git

Branches principais:

- `main`: versão estável;
- `dev`: desenvolvimento ativo.

Trabalhar normalmente em `dev`.

Antes de mudanças estruturais relevantes:

1. verificar `git status`;
2. confirmar a branch atual;
3. recomendar ou criar um commit de segurança quando apropriado.

Não fazer push, merge, rebase, reset destrutivo ou alteração de histórico sem solicitação explícita do usuário.

Não alterar commits existentes sem autorização.

---

## Frontend

Stack:

- Vue.js
- TypeScript
- Vue Router
- Pinia
- Vite
- ESLint
- Prettier
- Oxlint

Estrutura atual deve seguir as convenções naturais do Vue.

Direção esperada:

`src/views/`
Páginas completas.

`src/components/`
Componentes reutilizáveis.

`src/router/`
Rotas.

`src/stores/`
Estado global com Pinia apenas quando necessário.

`src/services/`
Comunicação com API e integrações.

`src/types/`
Tipos e interfaces TypeScript quando fizer sentido.

Evitar:

- `App.vue` gigante;
- lógica de API espalhada por componentes;
- uso desnecessário de `any`;
- componentização excessiva;
- Pinia para estados exclusivamente locais;
- lógica financeira crítica somente no frontend.

Use `<script setup lang="ts">` como padrão nos componentes Vue.

---

## Backend

Backend localizado em:

`server/`

Tecnologias atuais:

- Node.js
- TypeScript
- Fastify
- Zod
- Supabase
- `@fastify/cors`

A arquitetura deve seguir MVC de forma pragmática.

Separação desejada:

- routes: definição das rotas HTTP;
- controllers: tratamento das requisições e respostas;
- models/repositories ou camada equivalente: acesso aos dados;
- services: regras reutilizáveis quando necessárias.

Não criar camadas vazias apenas para aparentar arquitetura.

O frontend Vue nunca deve acessar diretamente o banco.

Fluxo esperado:

Vue
→ API HTTP
→ Node/Fastify
→ Supabase

---

## Supabase

Supabase é a decisão atual do projeto para persistência/autenticação.

Variáveis sensíveis devem ficar em `.env`.

Nunca:

- commitar `.env`;
- colocar tokens ou chaves no código;
- imprimir segredos em respostas;
- usar `service_role` no frontend.

O backend atual usa variáveis similares a:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `PORT`
- `CORS_ORIGIN`

Antes de alterar regras de autenticação ou políticas do Supabase, consultar o usuário.

---

## Requisitos funcionais principais

A versão acadêmica deve permanecer pequena.

Requisitos levantados incluem:

- cadastro de receitas;
- cadastro de despesas;
- cadastro de contas bancárias/caixas;
- extrato;
- relatório de receitas;
- relatório de despesas;
- atualização coerente de saldo.

A faculdade exige:

- 3 cadastros;
- 1 movimento;
- 3 relatórios.

O mapeamento final desses itens pode evoluir durante o desenvolvimento. Não congelar uma interpretação sem alinhamento.

---

## Cadastro de despesas

A tela inicial de despesas contém, no mínimo:

- descrição;
- valor;
- vencimento;
- categoria.

O formulário Vue utiliza `ref` e `v-model`.

Ao integrar com backend:

- validar campos;
- exibir erro compreensível;
- limpar formulário somente após sucesso da API;
- não perder os dados digitados quando houver erro.

---

## Cadastro de receitas

A API de receitas criada no backend deve ser tratada como fonte do contrato real.

Campos observados até agora incluem:

- `conta_id`;
- `descricao`;
- `valor`;
- `data_recebimento`;
- `categoria`.

Antes de implementar ou alterar a tela Vue de receitas, verificar o contrato atual do backend nos arquivos do projeto.

Não inventar payloads quando o código real puder ser inspecionado.

---

## UX/UI

O usuário final do KRAB é leigo em finanças.

Priorizar:

- linguagem simples;
- formulários curtos;
- mensagens de erro claras;
- ações principais evidentes;
- navegação previsível;
- interface responsiva;
- formatação monetária adequada;
- baixo ruído visual.

Não depender de gráficos para comunicar informações essenciais.

---

## Escopo a evitar agora

Não adicionar sem pedido explícito:

- IA;
- WhatsApp;
- integração bancária;
- OFX;
- emissão fiscal;
- microserviços;
- filas;
- mensageria;
- dashboards complexos;
- abstrações excessivas.

---

## Comandos e ambiente

Ambiente principal do usuário:

- Linux Mint
- Node via NVM
- npm
- Git
- GitHub CLI
- VS Code

Antes de sugerir instalação de uma ferramenta, verificar se ela já está instalada e qual versão está disponível, quando isso ainda não estiver conhecido.

Para diagnóstico:

- prefira comandos simples;
- peça o retorno do terminal quando ele determinar o próximo passo;
- não presumir sucesso de comandos que ainda não foram executados.

---

## Qualidade

Antes de considerar uma alteração concluída, quando aplicável:

- verificar erros de TypeScript;
- rodar lint/format apropriado;
- testar manualmente o fluxo alterado;
- conferir `git diff`;
- conferir `git status`.

Não modificar arquivos não relacionados à tarefa.

---

## Regra central

Quando houver dúvida entre:

1. fazer uma solução mais sofisticada;
2. fazer uma solução simples que atende corretamente o KRAB;

preferir a solução simples.

Quando houver dúvida relevante de produto ou arquitetura, perguntar ao usuário antes de decidir.

## Fontes oficiais de contexto

Antes de decisões relevantes, consulte:

`docs/KRAB_DOCUMENTO_OFICIAL_DIRECIONAL.md`

Essa é a fonte principal de contexto funcional e técnico do projeto.

Existe também uma versão editável em:

`docs/KRAB_DOCUMENTO_OFICIAL_DIRECIONAL.docx`

## Referências visuais

O protótipo principal da Home está em:

`docs/prototipos/home-dashboard.jpeg`

Use essa imagem como referência visual para a tela inicial do KRAB.

## Divergências entre documentação e código

Quando houver divergência entre:

- documentação;
- implementação atual;
- protótipos;
- requisitos acadêmicos;

não corrigir automaticamente nenhum dos lados.

Primeiro:

1. identificar claramente a divergência;
2. verificar qual fonte representa a decisão mais recente;
3. informar o usuário;
4. aguardar decisão quando a alteração puder afetar contrato, arquitetura, banco ou documentação.

O código existente não deve ser considerado automaticamente correto apenas por estar implementado.
