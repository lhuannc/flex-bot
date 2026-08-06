# FlexBot — Contexto Completo do Projeto (Project Handover)

Este documento foi criado para fornecer a qualquer novo agente de IA ou desenvolvedor um **contexto completo e consolidado** da arquitetura, funcionalidades, regras de negócio, identidade visual e estrutura técnica do **FlexBot**.

---

## 📌 1. O que é o FlexBot?

O **FlexBot** é um bot e painel administrativo para **Discord**, desenvolvido para a **Prefeitura do Rio (2025)**. 

### Objetivos Principais:
1. **Validação Corporativa de Matrículas**: Validar se o código enviado por um colaborador, servidor público ou estagiário consta na base oficial de matrículas permitidas (`data/matriculas.json`).
2. **Atribuição Automática de Cargos (Roles)**: Atribuir o cargo correspondente no Discord assim que a matrícula for validada.
3. **Automação de Canais de Texto**: Tratar validações feitas diretamente em canais públicos autorizados com auto-deleção programada das mensagens de resposta.
4. **Atendimento Interativo via URA em DMs**: Atendimento automatizado em mensagens privadas (DM) com menu principal, submenus (opções dentro de opções) e **Consequências Combináveis (E/OU)**.
5. **Dashboard Web Administrativo**: Painel web rodando em `http://localhost:3000` para gerenciamento em tempo real da base de matrículas, regras e URA.

---

## 🏗️ 2. Arquitetura Técnica & Stack de Tecnologias

- **Runtime**: Node.js 20 (Alpine Linux).
- **Discord Library**: `discord.js` v14.
- **Servidor Web**: `express` v4 + `cors` v2.
- **Frontend Dashboard**: HTML5 semântico, Vanilla CSS3 (Design System Prefeitura do Rio 2025) e JavaScript puro.
- **Containerização**: Docker & Docker Compose (`docker-compose.yml`, container: `flex-bot-app`).
- **Persistência**: Arquivos JSON na pasta `./data/` mapeados via volume host-bound (`./data:/app/data`).

---

## 📂 3. Estrutura de Diretórios

```
c:/projetos/flex-bot/
├── commands/               # Comandos Slash (/status, /matricula)
├── events/                 # Handlers de eventos do Discord (messageCreate, guildMemberAdd, clientReady)
├── services/               # Lógica de negócio e acesso a dados
│   ├── databaseService.js  # CRUD e busca em tempo real de matriculas.json
│   ├── ruleService.js      # CRUD de regras exclusivas para canais de texto
│   ├── dmRuleService.js    # CRUD de regras de DM, URA e gatilhos
│   ├── ivrService.js       # Motor navegacional de URA e executor de consequências
│   └── discordService.js   # Integração com a API do Discord (cargos, canais, DMs)
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
│   └── matriculas.json     # Lista oficial de matrículas autorizadas
├── docs/                   # Documentações do projeto
│   ├── project_context.md            # ESTE ARQUIVO (Contexto Master)
│   ├── data_storage_architecture.md  # Arquitetura de persistência JSON/Docker
│   └── system_limitations.md         # Rate limits do Discord e concorrência
├── docker-compose.yml      # Configuração do container Docker
├── Dockerfile              # Imagem do Node 20 Alpine
└── index.js                # Ponto de entrada (Inicializa Bot + Servidor Web Express)
```

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
- Permite vincular uma regra a um canal de texto específico (`allowedChannelId`) e a um cargo (`roleId`).
- Quando um usuário digita os 8 números no canal, o FlexBot valida em `matriculas.json`, atribui o cargo no Discord e envia a resposta de sucesso/erro.
- **Auto-deleção**: A mensagem de resposta apaga-se automaticamente após o tempo configurado (ex: 10 segundos). Digitar `0` torna a resposta permanente.

### 5.2 Construtor de URA Multi-Nível & Consequências das Ações
- O usuário navega pela DM digitando os números das opções (ex: `1`, depois `2`).
- Cada opção ou sub-opção possui **Consequências Combináveis (E/OU)**:
  1. 💬 **Enviar Mensagem / Resposta / Link Direto**.
  2. 🏷️ **Atribuir Cargo Direto no Discord** (selecionável por um `<select>` dropdown com os cargos do servidor).
  3. 🎓 **Solicitar Validação de Matrícula** (pede o código, valida na base e atribui o cargo).
  4. 🌳 **Abrir Novo Nível / Submenu** (sub-opções `1.1`, `1.2`...).

### 5.3 Gestão de Matrículas
- Permite a colar dezenas ou centenas de milhares de matrículas de uma só vez via texto (separadas por vírgula, espaço ou quebra de linha).
- **Busca em Tempo Real**: Campo de pesquisa instantânea para filtrar matrículas cadastradas.

---

## 🚀 6. Como Rodar o Projeto

```bash
# Entrar no diretório do projeto
cd c:/projetos/flex-bot

# Subir a aplicação via Docker Compose
docker compose up -d --build

# Verificar logs em tempo real
docker logs flex-bot-app -f
```

- **Dashboard Web**: `http://localhost:3000`
