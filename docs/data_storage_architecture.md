# Arquitetura de Armazenamento de Dados (Data Storage) — FlexBot

Este documento descreve como o **FlexBot** armazena, gerencia e persiste todas as suas configurações, regras de canais, árvore de URA e a base oficial de matrículas autorizadas.

---

## 📁 1. Visão Geral da Estrutura de Arquivos

O sistema utiliza um modelo de **armazenamento local em JSON** de alta performance, sem necessidade de banco de dados SQL/NoSQL externo. Todos os arquivos de dados ficam salvos no diretório `./data/` da raiz do projeto:

```
c:/projetos/flex-bot/
└── data/
    ├── rules.json          # Regras exclusivas para validação em Canais do Stoat
    ├── dm_rules.json       # Estrutura da Árvore de URA Multi-Nível e Consequências
    ├── dm_triggers.json    # Gatilhos de disparo automático de DM (Server Join / Palavras-chave)
    ├── welcome.json        # Configurações da mensagem de boas-vindas
    ├── matriculas.json     # Base oficial de matrículas autorizadas no sistema
    └── matriculas_usos.json # Registro de matrículas já consumidas (uso único)
```

---

## 🛡️ 2. Persistência em Containers Docker

Para garantir que **nenhum dado seja perdido** quando o container Docker for reiniciado, atualizado ou recompilado, a pasta `./data/` está mapeada como um **Volume Host-Bound** no arquivo [`docker-compose.yml`](file:///c:/projetos/flex-bot/docker-compose.yml):

```yaml
services:
  flex-bot:
    build: .
    container_name: flex-bot-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    env_file:
      - .env
    volumes:
      - ./data:/app/data    # 👈 Mapeamento persistente entre a máquina hospedeira e o container
```

---

## 📄 3. Detalhamento dos Arquivos de Dados

### 3.1 `data/rules.json` — Regras de Canal no modelo **Quando → Então**
Armazena a lista de regras do wizard de canal. Cada regra tem **um gatilho** (`triggerType`) e **uma ou duas consequências** (`actions`).

> 📌 Os IDs do Stoat são **ULIDs** (ex: `01HB2C3D4E5F6G7H8J9K0LMNPQ`), e não números longos como os snowflakes do Discord.

```json
[
  {
    "id": "rule-1786027179770",
    "name": "Validação Canal Oficial",
    "description": "Regra exclusiva para o canal oficial de matrículas",
    "matchType": "DATABASE",
    "triggerType": "MATRICULA",
    "actions": { "assignRole": true, "sendMessage": true },
    "serverId": "01HB2C3D4E5F6G7H8J9K0LMNPQ",
    "roleId": "01HB2C3D4E5F6G7H8J9K0ROLE1",
    "allowedChannelId": "01HB2C3D4E5F6G7H8J9K0CHAN1",
    "deleteDelaySeconds": 10,
    "successMessage": "✅ **Acesso Liberado!** {user}, sua matrícula foi validada com sucesso.",
    "errorMessage": "❌ {user}: **Matrícula não encontrada.** Verifique os 8 números digitados.",
    "usedMessage": "🚫 {user}: **Esta matrícula já foi utilizada.**",
    "active": true
  }
]
```

#### QUANDO — `triggerType` (gatilho único por regra)

| Valor | Dispara em | Papel do `allowedChannelId` |
|---|---|---|
| `MATRICULA` | Alguém digita uma matrícula no canal (`messageCreate`) | Canal **escutado** para validação |
| `MEMBER_JOIN` | Um novo integrante entra no servidor (`serverMemberJoin`) | Canal onde a **mensagem é publicada** |

Cada regra tem um gatilho só — para cobrir os dois eventos, crie duas regras.

#### ENTÃO — `actions` (consequências combináveis)

| Ação | Efeito |
|---|---|
| `assignRole` | Atribui `roleId` ao usuário, mesclando com os cargos atuais |
| `sendMessage` | Publica no canal e agenda a auto-deleção conforme `deleteDelaySeconds` |
| `sendDM` | Envia `dmMessage` na **DM privada** do usuário (bloqueio de DMs é registrado no log sem afetar as demais ações) |

Com `triggerType: "MEMBER_JOIN"`, o `successMessage` é a **mensagem de boas-vindas**; `errorMessage` e `usedMessage` ficam sem uso (não existe falha ao entrar no servidor) e o painel os oculta.

> 🔁 **Compatibilidade:** regras gravadas antes deste modelo não têm `triggerType` nem `actions`. O `normalizeRule()` preenche `MATRICULA` + `assignRole` e `sendMessage` ligadas (o comportamento anterior); `sendDM` nasce **desligada** em regras antigas, já que é uma consequência nova — nenhuma regra existente muda de efeito.

#### 🔄 Compatibilidade com dados da versão Discord

Regras gravadas pela versão anterior (Discord) usavam o campo **`guildId`**. Ao ler o arquivo, o `ruleService.js` **converte automaticamente `guildId` → `serverId`**, e regrava no novo formato na próxima escrita. Nenhuma edição manual é necessária.

⚠️ **Porém**, o *valor* do ID antigo (um snowflake do Discord) **não é válido no Stoat**. Após a migração é preciso **reconfigurar cada regra pelo Dashboard**, selecionando novamente servidor, cargo e canal nos menus suspensos.

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
        "roleId": "01HB2C3D4E5F6G7H8J9K0ROLE1",
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
              "roleId": "01HB2C3D4E5F6G7H8J9K0ROLE2"
            }
          }
        ]
      }
    }
  ]
}
```

### 3.3 `data/matriculas.json` — Base Oficial de Matrículas Autorizadas
Armazena a lista numérica de matrículas permitidas no sistema. Cadastros em lote via área de texto removem automaticamente espaços, vírgulas e números duplicados.

> ✅ Este arquivo é **agnóstico de plataforma** — permanece 100% válido ao migrar do Discord para o Stoat.

```json
[
  "12345678",
  "87654321",
  "11223344",
  "40123456",
  "55443322"
]
```

### 3.3.1 `data/matriculas_usos.json` — Registro de Uso Único
Cada matrícula libera o acesso **uma única vez**. Assim que uma validação é concluída com sucesso (comando `!matricula`, DM, canal autorizado ou URA), a matrícula é gravada neste arquivo e passa a ser recusada em qualquer nova tentativa — inclusive do mesmo usuário.

```json
{
  "40123456": {
    "userId": "01HB2C3D4E5F6G7H8J9K0USER1",
    "username": "maria.silva",
    "origin": "URA",
    "usedAt": "2026-08-14T14:28:38.366Z"
  }
}
```

Regras de manutenção:

- **Liberar novamente:** pelo painel web (botão *Liberar* na linha da matrícula ou *Liberar Selecionadas*), ou via `POST /api/matriculas/:numero/liberar` e `POST /api/matriculas/liberar-bulk`.
- **Exclusão da base:** ao remover uma matrícula de `matriculas.json`, o registro de uso correspondente também é apagado.
- **Rollback automático:** se a matrícula for validada mas a atribuição do cargo falhar no Stoat, o consumo é desfeito para que o usuário possa tentar novamente.

### 3.4 `data/dm_triggers.json` — Gatilhos de Disparo de DM
Armazena os gatilhos automáticos de **mensagem privada** (ao entrar no servidor ou saudações por palavras-chave):

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

> 💡 Boas-vindas **em canal público** não ficam aqui — são uma regra do wizard com `triggerType: "MEMBER_JOIN"` (ver §3.1). `getDMTriggers()` mescla o padrão nas chaves ausentes, então arquivos de versões anteriores continuam válidos.

---

## ⚙️ 4. Serviços de Leitura e Escrita (Internal APIs)

A leitura e atualização dos dados são centralizadas nos módulos Node.js (ES Modules) localizados na pasta `services/`:

- [`services/databaseService.js`](file:///c:/projetos/flex-bot/services/databaseService.js): Gerencia inserções individuais, buscas por filtro, deleções e inserção/remoção em lote (`/api/matriculas/bulk`, `/api/matriculas/delete-bulk`), além do controle de uso único (`consumirMatricula`, `liberarMatricula`, `/api/matriculas/usos`).
- [`services/ruleService.js`](file:///c:/projetos/flex-bot/services/ruleService.js): Gerencia o CRUD das regras de automação de canais e a normalização `guildId → serverId`.
- [`services/dmRuleService.js`](file:///c:/projetos/flex-bot/services/dmRuleService.js): Gerencia a persistência da árvore de URA e gatilhos de mensagem direta.
- [`services/stoatService.js`](file:///c:/projetos/flex-bot/services/stoatService.js): Não persiste em disco — é a fronteira de integração com a API do Stoat.
