# Layout da Aplicação — FlexBot

Este documento descreve o **layout** do FlexBot em três níveis:

1. **Layout de arquivos** — onde cada coisa mora no repositório;
2. **Layout de execução** — quais processos sobem e como conversam entre si;
3. **Layout de interface** — a anatomia visual do Dashboard Web (grid, design system, telas e componentes).

> Documentos complementares: [`identidade_visual.md`](./identidade_visual.md) (padrão normativo de marca, cores, tipografia e componentes), [`project_context.md`](./project_context.md) (contexto geral), [`bot_architecture_and_multiplatform.md`](./bot_architecture_and_multiplatform.md) (arquitetura interna), [`data_storage_architecture.md`](./data_storage_architecture.md) (persistência) e [`access_flows.md`](./access_flows.md) (fluxos de acesso).

---

## 1. Layout de Arquivos

```
flex-bot/
├── index.js                     # Entrypoint: cria o Client do Stoat, carrega comandos/eventos e sobe o Express
├── package.json                 # ESM ("type": "module"), Node >= 22.15.0
├── Dockerfile / docker-compose.yml
├── .env / .env.example          # Token, IDs padrão, OAuth Google, BIND_ADDRESS, PUBLIC_URL
│
├── commands/                    # Comandos de texto com prefixo (o Stoat não tem Slash Commands)
│   ├── matricula.js             #   !matricula <numero>
│   └── status.js                #   !status
│
├── events/                      # Handlers de eventos do stoat.js
│   ├── ready.js                 #   conexão estabelecida + presença do bot
│   ├── messageCreate.js         #   roteador central: comandos → DM/URA → validação em canal
│   └── serverMemberJoin.js      #   boas-vindas e regras com gatilho "Novos membros"
│
├── services/                    # Regra de negócio, sem acoplamento com a plataforma
│   ├── stoatService.js          #   ÚNICO módulo que fala com o stoat.js (cargos, canais, DMs)
│   ├── databaseService.js       #   matrículas + registro de uso único
│   ├── ruleService.js           #   CRUD e avaliação de regras de canal
│   ├── dmRuleService.js         #   árvore de URA multi-nível
│   ├── dmTriggerService.js      #   gatilhos de DM (entrada, broadcast, palavras-chave)
│   ├── ivrService.js            #   motor da URA (sessões, menus, consequências)
│   ├── authService.js           #   OAuth Google + sessão em cookie assinado (HMAC-SHA256)
│   └── messageUtils.js          #   deleção e auto-deleção de mensagens
│
├── web/
│   ├── server.js                # Express: middlewares, auth, estáticos e ~30 rotas /api
│   └── public/                  # Front-end (HTML/CSS/JS puros — sem build step)
│       ├── index.html           #   Dashboard (5 telas em abas)
│       ├── app.js               #   Toda a lógica de UI e chamadas fetch
│       ├── style.css            #   Design system Prefeitura do Rio
│       └── login.html           #   Tela de login com Google
│
├── data/                        # Persistência em JSON (volume montado no Docker)
│   ├── matriculas.json          #   array de matrículas autorizadas
│   ├── matriculas_usos.json     #   mapa matrícula → { userId, username, origin, usedAt }
│   ├── rules.json               #   regras de canal
│   ├── dm_rules.json            #   saudação + árvore de URA
│   ├── dm_triggers.json         #   gatilhos de DM
│   └── welcome.json             #   configuração de boas-vindas
│
├── scripts/                     # setup-vm.sh (Linux) e setup-windows.ps1
└── docs/                        # Esta documentação
```

**Princípio de camadas:** `events/` e `commands/` são finos — apenas traduzem eventos da plataforma. Toda a decisão vive em `services/`. Nenhum módulo além de `stoatService.js` importa `stoat.js`, o que mantém o motor de regras e a URA agnósticos de plataforma.

---

## 2. Layout de Execução

Um único processo Node hospeda **duas frentes** que compartilham os mesmos serviços e os mesmos arquivos em `data/`:

```
                        ┌───────────────────────────────────────────────┐
                        │            Processo Node (index.js)           │
                        │                                               │
   WebSocket            │   ┌───────────────┐        ┌───────────────┐  │
   Stoat  ◄────────────►│   │  Bot (stoat)  │        │ Express :3000 │  │◄──── Navegador
   (eventos e API)      │   │ events/ cmds/ │        │  web/server   │  │      (Dashboard)
                        │   └───────┬───────┘        └───────┬───────┘  │
                        │           └────────┬───────────────┘          │
                        │                    ▼                          │
                        │              services/ (regra de negócio)     │
                        │                    ▼                          │
                        │              data/*.json (estado)             │
                        └───────────────────────────────────────────────┘
```

- A porta **3000** é publicada por padrão apenas em `127.0.0.1` (`BIND_ADDRESS` no `docker-compose.yml`); o acesso externo passa por Tailscale Serve.
- O bot e o Dashboard são independentes na inicialização: sem `STOAT_TOKEN`, o Express sobe mesmo assim para testes de interface.
- `data/` é montado como volume, então as configurações sobrevivem a rebuilds do contêiner.

---

## 3. Layout da Interface (Dashboard)

### 3.1 Grid principal

O documento inteiro é um flexbox de duas colunas (`.app-container`, `min-height: 100vh`): uma **sidebar fixa de 290px** e um **conteúdo fluido** que rola sozinho.

```
┌──────────────────────┬──────────────────────────────────────────────────────────────┐
│  .sidebar   (290px)  │  .main-content            (flex-grow: 1 · padding 36px 44px)  │
│  #13335a             │  #f4f6f9 · overflow-y: auto                                   │
│                      │                                                              │
│  ┌ .brand ─────────┐ │  ┌ .top-header ──────────────────────────────────────────┐   │
│  │ ◆ FLEXBOT       │ │  │ h1 #page-title           [ ⟳ Atualizar Dados ]        │   │
│  └─────────────────┘ │  │ p  #page-subtitle                                     │   │
│                      │  └───────────────────────────────────────────────────────┘   │
│  FLUXOS DE ATEND.    │                                                              │
│  ▸ Fluxo no Canal    │  ┌ section.tab-content.active ───────────────────────────┐   │
│  ▸ Fluxo na DM & URA │  │                                                       │   │
│                      │  │   (apenas UMA das 5 seções fica visível por vez)      │   │
│  GESTÃO DE DADOS     │  │                                                       │   │
│  ▸ Base de Matrículas│  │                                                       │   │
│  ▸ Limpeza de Cargos │  │                                                       │   │
│  ▸ DM Avulsa         │  │                                                       │   │
│                      │  └───────────────────────────────────────────────────────┘   │
│  ┌ .bot-status-card ┐│                                                              │
│  │ ● nome / servidor││                                          ┌ .toast ────────┐  │
│  └─────────────────┘ │                                          │ fixed 24/24 ↘  │  │
│  ┌ .session-card ───┐│                                          └────────────────┘  │
│  │ ⊙ e-mail   Sair  ││                                                              │
│  └─────────────────┘ │                                                              │
└──────────────────────┴──────────────────────────────────────────────────────────────┘
```

### 3.2 Design system

Definido em `:root` no topo de `web/public/style.css` — identidade visual **Prefeitura do Rio (2025)**: sidebar azul institucional + conteúdo claro.

| Token | Valor | Uso |
|---|---|---|
| `--color-primary` | `#13335a` | Sidebar, títulos, texto principal |
| `--color-primary-dark` | `#0d223d` | Hovers escuros |
| `--color-neutral-bg` | `#f4f6f9` | Fundo do conteúdo |
| `--color-white` | `#ffffff` | Fundo dos cards |
| `--color-neutral-light` | `#eceded` | Texto na sidebar |
| `--color-text-muted` | `#475569` | Texto secundário |
| `--color-border-light` | `rgba(19,51,90,.12)` | Bordas |
| `--color-gradient-blue-mid` | `#2a688f` | Ícones de destaque, scrollbar |
| `--color-accent-cyan` | `#42b9eb` | Item ativo, indicadores, "triângulo-ponto" |
| `--gradient-institucional` | `135deg #13335a → #2a688f` | Faixas e botões primários |
| `--gradient-cyan` | `135deg #2a688f → #42b9eb` | Logo e ícones de estatística |
| `--color-success` / `--color-warning` / `--color-danger` | `#10b981` / `#d97706` / `#ef4444` | Estados |
| `--font-family` | `Cera Pro`, `Inter`, system | Texto corrido |
| `--font-heading` | `Cera Pro Black`, `Outfit` | Títulos (peso 900, `letter-spacing: -0.03em`) |
| `--radius-sm` / `md` / `lg` | `6px` / `10px` / `14px` | Botões / caixas internas / cards |
| `--shadow-main` / `--shadow-hover` | `0 4px 20px` / `0 8px 28px` de `rgba(19,51,90,…)` | Elevação dos cards |

**Assinatura visual:** o elemento `<span class="triangulo-ponto">` aparece ao final de cada título — um triângulo ciano de 14×12px rotacionado 90°, usado como "ponto final" da marca.

**Dependências externas do front:** Google Fonts (Inter + Outfit) e Font Awesome 6.4 via CDN. Não há bundler, framework ou etapa de build — `index.html` carrega `style.css` e `app.js` diretamente.

### 3.3 Sidebar (`aside.sidebar`)

Coluna fixa de 290px em `display: flex; flex-direction: column; justify-content: space-between`, com quatro blocos:

| Bloco | Conteúdo |
|---|---|
| `.brand` | Ícone 48×48 com `--gradient-cyan` (`fa-landmark`) + wordmark **FLEXBOT** |
| `.nav-menu` | Duas seções rotuladas (`.nav-section-label`) com 5 `.nav-btn` no total |
| `.bot-status-card` | `#bot-status-badge` (bolinha que fica ciano com glow quando online), `#bot-username`, `#bot-server` |
| `.session-card` | E-mail autenticado + link **Sair** — só é exibido quando o login com Google está ativo |

Estado ativo do menu (`.nav-btn.active`): fundo em degradê ciano translúcido, texto ciano, **borda esquerda de 4px** e peso 700.

**Itens de navegação** (o `data-tab` de cada botão aponta para a `section` correspondente):

| Seção | Botão | `data-tab` |
|---|---|---|
| Fluxos de Atendimento | Fluxo no Canal | `channel-flow-tab` |
| Fluxos de Atendimento | Fluxo na DM & URA | `dm-flow-tab` |
| Gestão de Dados | Base de Matrículas | `database-tab` |
| Gestão de Dados | Limpeza de Cargos | `cleanup-tab` |
| Gestão de Dados | DM Avulsa | `dm-tab` |

### 3.4 Cabeçalho (`header.top-header`)

Barra `space-between` com o par título/subtítulo à esquerda e as ações à direita (`#btn-refresh` — "Atualizar Dados"). O `<h1>` tem 2.1rem na fonte de display.

Título e subtítulo são reescritos a cada troca de aba pelo mapa `tabTitles` em `web/public/app.js`:

| Aba | Título | Subtítulo |
|---|---|---|
| `channel-flow-tab` | Fluxo de Validação no Canal | Configure as regras de validação em canais de texto através do assistente passo a passo. |
| `dm-flow-tab` | Fluxo de Atendimento na DM & URA | Configure o atendimento automático privado, comunicados e menus URA com wizard dedicado. |
| `database-tab` | Base Oficial de Matrículas (matriculas.json) | Gerencie as matrículas numéricas autorizadas no sistema corporativo. |
| `cleanup-tab` | Limpeza de Cargos em Massa | Visualize os cargos do servidor e remova membros deles em lote. |
| `dm-tab` | Envio de Mensagem Direta Avulsa (DM) | Dispare mensagens diretas no privado de usuários específicos do Stoat. |

### 3.5 Área de conteúdo

Cinco `<section class="tab-content">`; apenas a que tem `.active` fica com `display: block` — as demais ficam em `display: none`. A troca é puramente client-side (`switchTab()` em `app.js`), sem recarregar a página nem alterar a URL.

---

## 4. Layout das Telas

### 4.1 Fluxo no Canal — `#channel-flow-tab`

Assistente de 3 passos para cadastrar/editar uma regra de canal, seguido da lista de regras já cadastradas.

```
┌ .wizard-stepper ────────────────────────────────────────────────────────┐
│  ①  Servidor & Canal ─── ②  Quando ─── ③  Então                         │
│     Identificação          Gatilho        Consequências                 │
└─────────────────────────────────────────────────────────────────────────┘

┌ form#form-channel-rule-wizard ──────────────────────────────────────────┐
│ .wizard-panel#channel-wizard-step-1  (visível)                          │
│   ┌ .content-card ────────────────────────────────────────────────────┐ │
│   │ 🏢 Passo 1: Servidor e Canal Específico Autorizado                │ │
│   ├───────────────────────────────────────────────────────────────────┤ │
│   │ .form-row →  [ Nome da Regra * ]      [ Descrição ]               │ │
│   │ .form-row →  [ Servidor do Stoat * ▾ ][ Canal Autorizado * ▾ ]    │ │
│   └───────────────────────────────────────────────────────────────────┘ │
│   .wizard-actions →                              [ Avançar ▸ ]          │
└─────────────────────────────────────────────────────────────────────────┘
```

| Passo | Painel | Campos principais |
|---|---|---|
| 1 — Servidor & Canal | `#channel-wizard-step-1` | `#channel-rule-name`, `#channel-rule-description`, `#channel-rule-server-id`, `#channel-rule-channel-id` |
| 2 — Quando | `#channel-wizard-step-2` | Radios `.trigger-option`: **Matrícula digitada** (`MATRICULA`) ou **Novos membros** (`MEMBER_JOIN`) |
| 3 — Então | `#channel-wizard-step-3` | Três `.action-block`, cada um com um `.switch`: **Atribuir cargo** (`#channel-rule-role-id`), **Enviar mensagem no canal** (auto-deleção, mensagens de sucesso/erro/já utilizada) e **Enviar DM** (`#channel-rule-dm-msg`); ao final, o switch `#channel-rule-active` |

Abaixo do wizard, o card **Regras de Canais Cadastradas** lista cada regra como `.rule-item` (nome + `.rule-tags` com badges + ações editar/excluir).

Os campos de mensagem aceitam as variáveis `{user}`, `{role}` e `{server}`, substituídas em `events/messageCreate.js`.

### 4.2 Fluxo na DM & URA — `#dm-flow-tab`

Mesmo padrão de wizard de 3 passos, para o atendimento privado.

| Passo | Painel | Conteúdo |
|---|---|---|
| 1 — Gatilhos | `#dm-wizard-step-1` | Três blocos com switch: **Boas-vindas no 1º acesso** (`#trigger-server-join-*`), **Comunicado para membros atuais** (`#trigger-existing-*` + botão de broadcast) e **Palavras-chave de ativação** (`#trigger-keywords-list`) |
| 2 — Menu da URA | `#dm-wizard-step-2` | `#ura-greeting-msg` + `.ivr-box` com as opções em `.ivr-option-card`; cada opção pode combinar mensagem, cargo, pedido de matrícula e submenu (`.suboptions-box`), em árvore multi-nível |
| 3 — Revisão | `#dm-wizard-step-3` | Resumo do atendimento configurado + botões de salvar e concluir |

### 4.3 Base de Matrículas — `#database-tab`

Um único `.content-card` dividido em três faixas:

```
┌ Base Oficial de Matrículas (matriculas.json) ───────────────────────────┐
│ [ textarea: matrículas separadas por vírgula, espaço ou linha ]         │
│                                        [ Adicionar em Massa ]           │
├─────────────────────────────────────────────────────────────────────────┤
│ Matrículas cadastradas   [Excluir sel.] [Liberar sel.] [Excluir filtro]  │
│                                              🔍 [ Pesquisar matrícula ]  │
├─ .table-responsive ─────────────────────────────────────────────────────┤
│ [☑] │ # │ Matrícula Autorizada │ Status de Uso │ Ações                   │
│  …  tbody#matriculas-table-body (renderizado por app.js)                 │
└─────────────────────────────────────────────────────────────────────────┘
```

O **Status de Uso** vem do cruzamento entre `matriculas.json` e `matriculas_usos.json`: disponível ou consumida (com usuário, origem e data). "Liberar" desfaz o consumo e devolve a matrícula ao pool.

### 4.4 Limpeza de Cargos — `#cleanup-tab`

```
┌ Limpeza de Cargos em Massa ─────────────────────────────────────────────┐
│ .form-row →  [ Servidor do Stoat * ▾ ]   [ Cargo para Filtrar * ▾ ]      │
├─────────────────────────────────────────────────────────────────────────┤
│ Membros    [Remover cargo dos sel.] [Remover de todos]  🔍 [Pesquisar]   │
├─ .table-responsive ─────────────────────────────────────────────────────┤
│ [☑] │ Membro │ ID do Usuário │ Cargos Atuais                             │
│  …  tbody#cleanup-table-body                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

Os selects são encadeados: escolher o servidor recarrega a lista de cargos e a de membros.

### 4.5 DM Avulsa — `#dm-tab`

Formulário simples em `.form-grid` (coluna única, `max-width: 600px`): `#dm-user-id` (ULID do usuário no Stoat), `#dm-message` e o botão de envio.

### 4.6 Tela de Login — `login.html`

Página independente, servida sem autenticação, centralizada na viewport:

```
              ┌ .login-card ──────────────────┐
              │            🤖                 │
              │          FlexBot              │
              │   acesso restrito · subtitle  │
              │  ┌ #login-alert (erros) ────┐ │
              │  └──────────────────────────┘ │
              │  [ G  Entrar com o Google  ]  │
              │  🛡  rodapé de segurança      │
              └───────────────────────────────┘
```

`#login-alert` só aparece quando a URL traz um erro do fluxo OAuth (por exemplo, e-mail fora da allowlist).

---

## 5. Biblioteca de Componentes

| Componente | Classe | Layout |
|---|---|---|
| Card de conteúdo | `.content-card` | Branco, `radius-lg`, `overflow: hidden`; `.card-header` (faixa com ícone + `h3`) e `.card-body` |
| Barra de progresso | `.wizard-stepper` | Flex branco, `padding 20px 32px`; `.wizard-step-item` + `.step-connector`, com estados `.active` e `.completed` |
| Painel de passo | `.wizard-panel` | Um por passo; visível só com `.active`. Rodapé `.wizard-actions` com Voltar/Avançar |
| Linha de formulário | `.form-row` | `grid auto-fit minmax(280px, 1fr)`, gap 20px — quebra em 1 coluna quando falta largura |
| Formulário em coluna | `.form-grid` | Flex column, gap 20px, `max-width: 600px` |
| Página de formulário | `.form-grid-page` | Flex column, gap 24px — empilha os cards de um passo |
| Interruptor | `.switch` / `.slider` | Toggle de 44px que liga/desliga cada bloco de ação (`.action-fields-disabled` esmaece os campos) |
| Opção de gatilho | `.trigger-option` | Card clicável com radio, `.trigger-title` e `.trigger-desc` |
| Tabela | `.table-responsive` > `.data-table` | Largura 100%, células `14px 18px`, cabeçalho fixo em tom claro |
| Item de regra | `.rule-item` | Linha `#f8fafc`, `radius-md`, com `.rule-info`, `.rule-tags` e `.rule-actions` |
| Caixa da URA | `.ivr-box` / `.ivr-option-card` / `.suboptions-box` | Blocos aninhados que representam os níveis do menu |
| Estatísticas | `.stats-grid` / `.stat-card` | `grid auto-fit minmax(240px, 1fr)`; ícone em degradê (`.cyan`, `.green`, `.purple`) + valor + rótulo |
| Selo | `.badge` | Pílula (`radius 20px`, `4px 12px`) nas variantes `badge-success`, `badge-warning`, `badge-cyan`, `badge-purple` |
| Botão | `.btn` | Variantes `.btn-primary` (degradê institucional), `.btn-outline`, `.btn-danger` |
| Notificação | `.toast` | `position: fixed` a 24px do canto inferior direito; `.show` para exibir, `.success` / `.error` para o tom |

---

## 6. Layout de Rotas (mapa tela → API → dado)

O `web/server.js` monta as camadas nesta ordem: `cors` → `express.json` → sessão em cookie → rotas `/auth/*` → **barreira de autenticação** → estáticos de `web/public/` → rotas `/api/*`.

Rotas públicas mesmo com login ativo: `/login.html`, `/style.css`, `/favicon.ico` e tudo sob `/auth/`. Requisições não autenticadas recebem **401 JSON** em `/api/*` e **redirect para `/login.html`** na navegação.

| Tela | Endpoints principais | Serviço | Arquivo em `data/` |
|---|---|---|---|
| Sidebar (status) | `GET /api/status`, `GET /auth/me` | `stoatService`, `databaseService` | — |
| Fluxo no Canal | `GET/POST /api/rules`, `PUT/DELETE /api/rules/:id` | `ruleService` | `rules.json` |
| Fluxo na DM & URA | `GET/POST /api/dm-rules`, `GET/POST /api/dm-triggers`, `POST /api/dm-triggers/broadcast-existing` | `dmRuleService`, `dmTriggerService`, `ivrService` | `dm_rules.json`, `dm_triggers.json` |
| Base de Matrículas | `GET /api/matriculas`, `GET /api/matriculas/usos`, `POST /api/matriculas`, `POST /api/matriculas/bulk`, `POST /api/matriculas/delete-bulk`, `POST /api/matriculas/:numero/liberar`, `POST /api/matriculas/liberar-bulk`, `DELETE /api/matriculas/:numero` | `databaseService` | `matriculas.json`, `matriculas_usos.json` |
| Limpeza de Cargos | `GET /api/stoat/servers/:serverId/members`, `POST /api/roles/cleanup` | `stoatService` | — |
| DM Avulsa | `POST /api/send-dm` | `stoatService` | — |
| Seletores (todas) | `GET /api/stoat/servers`, `.../roles`, `.../channels` | `stoatService` | — |

---

## 7. Restrições Conhecidas do Layout

- **Sem media queries.** O `style.css` não define nenhum breakpoint: a sidebar mantém 290px fixos e o `body` usa `overflow-x: hidden`. O Dashboard é desenhado para desktop; em telas estreitas o conteúdo é comprimido, não reorganizado. Os grids `auto-fit` (`.form-row`, `.stats-grid`) são o único comportamento fluido.
- **Sem tema escuro.** A paleta é única e clara por decisão de identidade visual.
- **Sem roteamento de URL.** As cinco telas são abas em memória; recarregar a página sempre volta para "Fluxo no Canal".
- **Dependência de CDN.** Fontes e ícones vêm de `fonts.googleapis.com` e `cdnjs.cloudflare.com` — sem internet, a interface funciona mas perde tipografia e ícones.
- **Front sem build.** `index.html`, `app.js` e `style.css` são servidos como estão; qualquer alteração é refletida com um simples reload.
