- Vite

## Objetivo

Construir uma interface simples, clara e fácil de manter para usuários leigos em finanças.

## Organização esperada

- `views/`: páginas completas
- `components/`: componentes reutilizáveis
- `router/`: definição das rotas
- `stores/`: estado global somente quando necessário
- `services/`: comunicação com o backend
- `types/`: tipos e interfaces TypeScript
- `assets/`: recursos visuais

## Vue

Usar preferencialmente:

```vue
<script setup lang="ts">

Para estado local:
- preferir ref e computed;
- usar watch apenas quando necessário;
- não colocar estados locais no Pinia sem motivo.
Para formulários:
- utilizar v-model;
- utilizar v-model.number para valores numéricos quando apropriado;
- usar @submit.prevent em formulários;
- não limpar campos antes de confirmação de sucesso do backend;
- preservar os dados digitados em caso de erro da API.
Componentes
Criar componentes quando:
- houver reutilização;
- a página ficar difícil de entender;
- existir responsabilidade visual ou funcional claramente separada.
Evitar componentização excessiva.
Não transformar cada bloco pequeno em um componente sem necessidade.
Views
Views representam páginas completas.
Exemplos:
- HomeView.vue
- DespesasView.vue
- ReceitasView.vue
Uma View pode coordenar componentes e chamadas de serviço.
Router
Toda nova página deve ser registrada explicitamente no Vue Router.
Evitar navegação por <a> para rotas internas.
Preferir:
<RouterLink>

ou navegação programática pelo Vue Router.
Comunicação com backend
O frontend não acessa diretamente Supabase.
Fluxo obrigatório:
Vue
→ API Node/Fastify
→ Supabase
Chamadas HTTP devem ficar preferencialmente em src/services/.
Evitar fetch() duplicado e espalhado por vários componentes.
Antes de implementar uma integração:
1. verificar o contrato real da rota no backend;
2. verificar os campos do payload;
3. verificar autenticação necessária;
4. verificar formato da resposta;
5. verificar tratamento de erro.
Não inventar campos se o backend puder ser inspecionado.
TypeScript
Evitar any.
Criar interfaces ou tipos quando estruturas começarem a ser reutilizadas.
Exemplo:
interface Despesa {
  id: string
  descricao: string
  valor: number
}

UX
O usuário do KRAB é leigo.
Priorizar:
- linguagem simples;
- formulários curtos;
- feedback de sucesso e erro;
- botões claros;
- navegação previsível;
- valores monetários bem formatados.
Aprendizado
O desenvolvedor principal ainda está aprendendo Vue.
Ao realizar mudanças relevantes:
- explicar brevemente o conceito usado;
- evitar soluções excessivamente abstratas;
- preferir código legível;
- não introduzir padrões avançados sem necessidade.
Validação antes de concluir
Quando aplicável:
- verificar erros TypeScript;
- verificar a rota;
- testar manualmente a tela;
- verificar console do navegador;
- rodar formatter/linter.
```
