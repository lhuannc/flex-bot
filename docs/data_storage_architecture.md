# Arquitetura de Armazenamento de Dados (Data Storage) — FlexBot

Este documento descreve como o **FlexBot** armazena, gerencia e persiste todas as suas configurações, regras de canais, árvore de URA e a base oficial de matrículas autorizadas.

---

## 📁 1. Visão Geral da Estrutura de Arquivos

O sistema utiliza um modelo de **armazenamento local em JSON** de alta performance, sem necessidade de banco de dados SQL/NoSQL externo. Todos os arquivos de dados ficam salvos no diretório `./data/` da raiz do projeto:

```
c:/projetos/gusta-bot/
└── data/
    ├── rules.json          # Regras exclusivas para validação em Canais do Discord
    ├── dm_rules.json       # Estrutura da Árvore de URA Multi-Nível e Consequências
    ├── dm_triggers.json    # Gatilhos de disparo automático de DM (Server Join / Palavras-chave)
    └── matriculas.json     # Base oficial de matrículas autorizadas no sistema
```

---

## 🛡️ 2. Persistência em Containers Docker

Para garantir que **nenhum dado seja perdido** quando o container Docker for reiniciado, atualizado ou recompilado, a pasta `./data/` está mapeada como um **Volume Host-Bound** no arquivo [`docker-compose.yml`](file:///c:/projetos/gusta-bot/docker-compose.yml):

```yaml
version: '3.8'

services:
  gusta-bot:
    build: .
    container_name: gusta-bot-app
    restart: always
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data    # 👈 Mapeamento persistente entre a máquina hospedeira e o container
```

---

## 📄 3. Detalhamento dos Arquivos de Dados

### 3.1 `data/rules.json` — Regras de Canais de Texto
Armazena a lista de regras exclusivas para validação direta em canais do Discord:

```json
[
  {
    "id": "rule-1786027179770",
    "name": "Validação Canal Oficial",
    "description": "Regra exclusiva para o canal oficial de matrículas",
    "matchType": "DATABASE",
    "guildId": "123456789012345678",
    "roleId": "987654321098765432",
    "allowedChannelId": "112233445566778899",
    "deleteDelaySeconds": 10,
    "successMessage": "✅ **Acesso Liberado!** {user}, sua matrícula foi validada com sucesso.",
    "errorMessage": "❌ {user}: **Matrícula não encontrada.** Verifique os 8 números digitados.",
    "active": true
  }
]
```

### 3.2 `data/dm_rules.json` — Árvore de URA Multi-Nível & Consequências
Armazena a mensagem de boas-vindas e toda a estrutura navegacional de opções e sub-opções com **Consequências Combináveis (E/OU)**:

```json
{
  "greeting": {
    "enabled": true,
    "message": "👋 **Olá {user}! Seja bem-vindo(a) ao atendimento da Prefeitura do Rio.**\n\nPor favor, selecione uma das opções abaixo:"
  },
  "ivrTree": [
    {
      "id": "opt-1",
      "trigger": "1",
      "label": "1 - Servidor Público / Estagiário",
      "consequences": {
        "sendMessage": true,
        "responseMessage": "Acesse nosso portal do servidor: https://rio.rj.gov.br",
        "assignRole": true,
        "roleId": "987654321098765432",
        "requestMatricula": true,
        "promptMessage": "Por favor, digite sua matrícula de 8 dígitos:",
        "openSubmenu": true,
        "submenuPrompt": "📌 Selecione sua secretaria:",
        "suboptions": [
          {
            "id": "sub-1-1",
            "trigger": "1",
            "label": "1 - Secretaria de Saúde",
            "consequences": {
              "requestMatricula": true,
              "promptMessage": "Digite sua matrícula da Saúde:",
              "roleId": "111222333444555666"
            }
          }
        ]
      }
    }
  ]
}
```

### 3.3 `data/matriculas.json` — Base Oficial de Matrículas Autorizadas
Armazena a lista numérica de matrículas permitidas no sistema. Cadastros em lote via área de texto removem automaticamente espaços, vírgulas e números duplicados:

```json
[
  "12345678",
  "87654321",
  "11223344",
  "40123456",
  "55443322"
]
```

### 3.4 `data/dm_triggers.json` — Gatilhos de Disparo de DM
Armazena os gatilhos automáticos para conversas privadas (ao entrar no servidor ou saudações por palavras-chave):

```json
{
  "serverJoin": {
    "enabled": true,
    "message": "👋 **Seja bem-vindo(a) ao servidor!**"
  },
  "keywordGreeting": {
    "enabled": true,
    "keywords": ["oi", "olá", "ajuda", "matricula", "menu"]
  }
}
```

---

## ⚙️ 4. Serviços de Leitura e Escrita (Internal APIs)

A leitura e atualização dos dados são centralizadas nos módulos Node.js localizados na pasta `services/`:

- [`services/databaseService.js`](file:///c:/projetos/gusta-bot/services/databaseService.js): Gerencia inserções individuais, buscas por filtro, deleções e inserção em lote (`/api/matriculas/bulk`).
- [`services/ruleService.js`](file:///c:/projetos/gusta-bot/services/ruleService.js): Gerencia o CRUD das regras de automação de canais.
- [`services/dmRuleService.js`](file:///c:/projetos/gusta-bot/services/dmRuleService.js): Gerencia a persistência da árvore de URA e gatilhos de mensagem direta.
