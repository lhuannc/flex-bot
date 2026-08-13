# FlexBot — Contexto Completo do Projeto (Project Handover)

Este documento foi criado para fornecer a qualquer novo agente de IA ou desenvolvedor um **contexto completo e consolidado** da arquitetura, funcionalidades, regras de negócio, identidade visual e estrutura técnica do **FlexBot**.

---

## 📌 1. O que é o FlexBot?

O **FlexBot** é um bot e painel administrativo para o **[Stoat](https://stoat.chat)** — plataforma de chat open-source (antiga Revolt) — desenvolvido para a **Prefeitura do Rio (2025)**.

### Objetivos Principais:
1. **Validação Corporativa de Matrículas**: Validar se o código enviado por um colaborador, servidor público ou estagiário consta na base oficial de matrículas permitidas (`data/matriculas.json`).
2. **Atribuição Automática de Cargos (Roles)**: Atribuir o cargo correspondente no Stoat assim que a matrícula for validada.
3. **Automação de Canais de Texto**: Tratar validações feitas diretamente em canais públicos autorizados com auto-deleção programada das mensagens de resposta.
4. **Atendimento Interativo via URA em DMs**: Atendimento automatizado em mensagens privadas (DM) com menu principal, submenus (opções dentro de opções) e **Consequências Combináveis (E/OU)**.
5. **Dashboard Web Administrativo**: Painel web rodando em `http://localhost:3000` para gerenciamento em tempo real da base de matrículas, regras e URA.

---

## 🏗️ 2. Arquitetura Técnica & Stack de Tecnologias

- **Runtime**: **Node.js 22** (Alpine Linux) em **modo ES Module**.
  - ⚠️ O `stoat.js` exige **Node.js >= 22.15.0** e **não funciona em CommonJS**. Todo o projeto usa `import`/`export`.
- **Biblioteca do Stoat**: `stoat.js` v7 (SDK oficial JavaScript do Stoat).
- **Servidor Web**: `express` v4 + `cors` v2.
- **Frontend Dashboard**: HTML5 semântico, Vanilla CSS3 (Design System Prefeitura do Rio 2025) e JavaScript puro.
- **Containerização**: Docker & Docker Compose (`docker-compose.yml`, container: `flex-bot-app`).
- **Persistência**: Arquivos JSON na pasta `./data/` mapeados via volume host-bound (`./data:/app/data`).

---

## 📂 3. Estrutura de Diretórios

```
c:/projetos/flex-bot/
├── commands/               # Comandos de TEXTO com prefixo (!status, !matricula)
├── events/                 # Handlers de eventos do Stoat
│   ├── ready.js            # Conexão estabelecida + definição do status/presença
│   ├── messageCreate.js    # Canais, DMs, URA e despacho de comandos
│   └── serverMemberJoin.js # DM de boas-vindas ao entrar no servidor
├── services/               # Lógica de negócio e acesso a dados
│   ├── databaseService.js  # CRUD e busca em tempo real de matriculas.json
│   ├── ruleService.js      # CRUD de regras exclusivas para canais de texto
│   ├── dmRuleService.js    # CRUD de regras de DM, URA e gatilhos
│   ├── ivrService.js       # Motor navegacional de URA e executor de consequências
│   └── stoatService.js     # Integração com a API do Stoat (cargos, canais, DMs)
├── web/
│   ├── server.js           # Servidor Express com APIs REST (/api/...)
│   └── public/             # Interface do Dashboard Web
│       ├── index.html      # Estrutura HTML do painel (Tabs, modais, formulários)
│       ├── style.css       # Design System Prefeitura do Rio (2025)
│       └── app.js          # Lógica do painel (Fetch, estado, renderizadores, busca)
├── data/                   # Arquivos de dados persistentes
│   ├── rules.json          # Regras de automação de canais
│   ├── dm_rules.json       # Árvore da URA e consequências das opções
│   ├── dm_triggers.json    # Gatilhos de disparo automático de DM
│   ├── welcome.json        # Configurações de boas-vindas
│   └── matriculas.json     # Lista oficial de matrículas autorizadas
├── docs/                   # Documentações do projeto
│   ├── project_context.md            # ESTE ARQUIVO (Contexto Master)
│   ├── stoat_installation_guide.md   # Criação do bot e permissões no Stoat
│   ├── data_storage_architecture.md  # Arquitetura de persistência JSON/Docker
│   └── system_limitations.md         # Rate limits do Stoat e concorrência
├── docker-compose.yml      # Configuração do container Docker
├── Dockerfile              # Imagem do Node 22 Alpine
└── index.js                # Ponto de entrada (Inicializa Bot + Servidor Web Express)
```

> 🗑️ **Removidos na migração para o Stoat:** `deploy-commands.js` e `events/interactionCreate.js` — ambos existiam apenas para os **Slash Commands** do Discord, que **não têm equivalente no Stoat** (a plataforma não possui API de *interactions*).

---

## 🎨 4. Identidade Visual (Prefeitura do Rio 2025)

O Dashboard Web segue estritamente o **Manual de Marca — Prefeitura do Rio 2025**:

- **Sidebar (Navegação)**: Azul Institucional (`#13335a`).
- **Main Content Area (Conteúdo)**: Fundo Neutro Claro (`#f4f6f9`), Cards Brancos (`#ffffff`) com bordas suaves e sombras leves.
- **Tipografia**: `Cera Pro` / `Inter` / `Outfit` com títulos em `#13335a` e `letter-spacing: -0.03em`.
- **Elemento Gráfico**: **Triângulo Ciano (`#42b9eb`)** como "ponto-final" ao lado dos títulos.
- **Barra de Rolagem Customizada**: Trilho suave com cursor em Azul Mid (`#2a688f`).

---

## ⚙️ 5. Funcionalidades Principais & Como Funcionam

### 5.1 Regras de Canais de Texto
- Permite vincular uma regra a um canal de texto específico (`allowedChannelId`) e a um cargo (`roleId`) dentro de um servidor (`serverId`).
- Quando um usuário digita os 8 números no canal, o FlexBot valida em `matriculas.json`, atribui o cargo no Stoat e envia a resposta de sucesso/erro.
- **Auto-deleção**: A mensagem original é sempre apagada; a resposta apaga-se automaticamente após o tempo configurado (ex: 10 segundos). Digitar `0` torna a resposta permanente.

### 5.2 Construtor de URA Multi-Nível & Consequências das Ações
- O usuário navega pela DM digitando os números das opções (ex: `1`, depois `2`).
- Cada opção ou sub-opção possui **Consequências Combináveis (E/OU)**:
  1. 💬 **Enviar Mensagem / Resposta / Link Direto**.
  2. 🏷️ **Atribuir Cargo Direto no Stoat** (selecionável por um `<select>` dropdown com os cargos do servidor).
  3. 🎓 **Solicitar Validação de Matrícula** (pede o código, valida na base e atribui o cargo).
  4. 🌳 **Abrir Novo Nível / Submenu** (sub-opções `1.1`, `1.2`...).

### 5.3 Gestão de Matrículas
- Permite colar dezenas ou centenas de milhares de matrículas de uma só vez via texto (separadas por vírgula, espaço ou quebra de linha).
- **Busca em Tempo Real**: Campo de pesquisa instantânea para filtrar matrículas cadastradas.
- **Exclusão em Massa**: Seleção múltipla por checkbox com deleção em lote.

### 5.4 Comandos de Texto (substituem os Slash Commands)
O Stoat não possui Slash Commands, portanto os comandos são interpretados a partir do conteúdo da mensagem, usando o `COMMAND_PREFIX` (padrão `!`):

| Comando | Função |
|---|---|
| `!matricula <numero>` | Valida a matrícula e atribui o cargo |
| `!status` | Estatísticas do bot e URL do Dashboard |

---

## 🔐 6. Variáveis de Ambiente

| Variável | Obrigatória | Descrição |
|---|---|---|
| `STOAT_TOKEN` | ✅ | Token do bot (Configurações → Meus Bots → Editar → Copiar) |
| `STOAT_API_URL` | — | API da instância. Padrão: `https://stoat.chat/api`. Aponte para a sua instância self-hosted se aplicável |
| `COMMAND_PREFIX` | — | Prefixo dos comandos de texto. Padrão: `!` |
| `PORT` | — | Porta do Dashboard Web. Padrão: `3000` |
| `SERVER_ID` | — | Servidor padrão de fallback (normalmente definido por regra no Dashboard) |
| `ROLE_ID` | — | Cargo padrão de fallback |
| `ALLOWED_CHANNEL_ID` | — | Canal padrão de fallback |

---

## 🚀 7. Como Rodar o Projeto

```bash
# Entrar no diretório do projeto
cd c:/projetos/flex-bot

# Subir a aplicação via Docker Compose
docker compose up -d --build

# Verificar logs em tempo real
docker logs flex-bot-app -f
```

- **Dashboard Web**: `http://localhost:3000`

Para rodar sem Docker é necessário **Node.js >= 22.15.0**:

```bash
npm install
npm start
```
