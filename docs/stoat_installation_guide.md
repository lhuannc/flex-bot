# Guia de Instalação e Configuração do FlexBot no Stoat

Este documento explica como criar a conta de bot do **FlexBot** no **[Stoat](https://stoat.chat)**, obter o token, convidá-lo para o servidor e ajustar as permissões necessárias.

> ℹ️ O Stoat é uma plataforma de chat **open-source** (anteriormente chamada *Revolt*), com conceitos muito próximos aos do Discord: **Servidores**, **Canais**, **Cargos (Roles)** e **Mensagens Diretas (DM)**.

---

## 🏷️ 1. Criando a Conta de Bot

Diferente do Discord, o Stoat **não possui um Developer Portal separado**. Tudo é feito dentro do próprio aplicativo:

1. Acesse [https://stoat.chat/app](https://stoat.chat/app) (ou a URL da sua instância self-hosted) e faça login.
2. Abra **Configurações** (Settings) no canto inferior esquerdo.
3. No menu lateral, clique em **Meus Bots** (My Bots).
4. Clique em **Criar um Bot** (Create a Bot).
5. Informe o nome de exibição — recomendado: **`FlexBot`** (ou `FlexBot Rio`) — e confirme.

> ✨ O nome definido aqui é o que aparecerá para os usuários no servidor e na tela de convite. Para alterá-lo depois, basta editar o bot nesta mesma tela.

---

## 🔑 2. Obtendo o Token do Bot

1. Ainda em **Configurações → Meus Bots**, clique em **Editar** (Edit) no FlexBot.
2. Clique em **Copiar** (Copy) ao lado do campo **Token**.
3. Cole o valor no arquivo `.env` do projeto:

```env
STOAT_TOKEN=cole_seu_token_aqui
```

> ⚠️ **O token é a senha do seu bot.** Nunca versione no Git (o `.env` já está no `.gitignore`) e nunca cole em conversas. Se ele vazar, clique em **Regenerar** (Regenerate) imediatamente.

### (Opcional) Avatar e Bot Público

Na mesma tela de edição você pode:
- Fazer upload da **logo/avatar oficial** da Prefeitura do Rio.
- Ativar **Bot Público** (Public Bot), caso outras pessoas além de você precisem convidar o FlexBot para os seus próprios servidores.

---

## 🔗 3. Convidando o FlexBot para o Servidor

1. Na tela de edição do bot, clique em **Copiar Link de Convite** (Copy Invite Link).
2. Abra a URL copiada no navegador.
3. Selecione o servidor de destino e confirme a adição.

> 💡 Ao contrário do Discord, o link de convite do Stoat **não carrega um número de permissões (`permissions=...`)**. As permissões do bot são concedidas depois, através dos **cargos do servidor** — veja a próxima seção.

---

## ⚠️ 4. Ajuste Obrigatório de Permissões e Hierarquia de Cargos (IMPORTANTE!)

Após adicionar o FlexBot, você **DEVE** realizar esta configuração para que a atribuição de cargos funcione:

### 4.1 Conceder as permissões

1. Abra **Configurações do Servidor** → **Cargos** (Roles).
2. Crie ou selecione o cargo do **FlexBot** e habilite:

| Permissão | Para quê |
|---|---|
| **Atribuir Cargos** (`AssignRoles`) | Conceder o cargo de acesso após validar a matrícula |
| **Enviar Mensagens** (`SendMessage`) | Responder nos canais e nas DMs |
| **Gerenciar Mensagens** (`ManageMessages`) | Apagar a matrícula digitada e auto-deletar as respostas |
| **Enviar Embeds** (`SendEmbeds`) | Renderizar o card do comando `!status` |
| **Ler Histórico de Mensagens** (`ReadMessageHistory`) | Acompanhar o canal de validação |

### 4.2 Ajustar a hierarquia (rank)

No Stoat cada cargo possui um **`rank` numérico**, e a regra é:

> **Quanto MENOR o número do rank, MAIOR a prioridade do cargo.**

1. Ainda em **Configurações do Servidor → Cargos**, **arraste o cargo do FlexBot para CIMA** de todos os cargos que ele precisará atribuir aos usuários.
2. Salve as alterações.

> ⚠️ Se o cargo do FlexBot estiver **abaixo** do cargo configurado na regra, a API do Stoat recusará a operação e o cargo **não será aplicado** — o bot registrará o aviso no log e informará o usuário de que a matrícula foi validada mas o cargo não pôde ser concedido.

---

## 🧪 5. Testando a Instalação

1. Suba a aplicação (`docker compose up -d --build`) e confirme no log:
   ```
   [Event Ready] Bot conectado com sucesso no Stoat como: FlexBot
   [Event Ready] Servidores conectados: Prefeitura do Rio
   ```
2. Abra o Dashboard em `http://localhost:3000` — o card lateral deve exibir o nome do bot e o servidor conectado.
3. No Stoat, envie `!status` em qualquer canal onde o bot tenha acesso.
4. Configure uma regra de canal pelo Dashboard e teste digitando uma matrícula válida no canal escolhido.
5. Envie `oi` na DM do bot para validar o menu de URA.

---

## 🧭 6. Diferenças em Relação ao Discord

| Conceito | Discord | Stoat |
|---|---|---|
| Portal de criação do bot | Discord Developer Portal (site externo) | Configurações → Meus Bots (dentro do app) |
| Identificador da aplicação | `CLIENT_ID` + `DISCORD_TOKEN` | Apenas o **token** do bot |
| Formato dos IDs | Snowflake numérico (`1532769863808843959`) | **ULID** (`01HB2C3D4E5F6G7H8J9K0LMNPQ`) |
| Servidor | *Guild* | *Server* |
| Comandos | Slash Commands (`/matricula`) | Comandos de texto com prefixo (`!matricula`) |
| Convite | URL com `permissions=` e `scope=` | Link de convite simples; permissões via cargos |
| Hierarquia de cargos | Posição na lista (maior = mais forte) | `rank` numérico (menor = mais forte) |
