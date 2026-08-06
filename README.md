# 🤖 FlexBot - Bot de Validação para Discord com Painel Web

O **FlexBot** é um bot modular em Node.js (utilizando **discord.js v14**) desenvolvido para validação de matrículas corporativas/acadêmicas e concessão automática de cargos (roles) no Discord.

O projeto inclui um **Painel Web interativo (Dashboard)** para gerenciar a base de dados de matrículas, criar e editar **múltiplas regras de acesso com canais e cargos específicos** dinamicamente e enviar **Mensagens Diretas (DMs / Privado)** para os usuários.

---

## 📋 Sumário
- [Funcionalidades](#-funcionalidades)
- [Passo a Passo: Criar e Configurar o Bot no Portal de Desenvolvedores do Discord](#-passo-a-passo-criar-e-configurar-o-bot-no-portal-de-desenvolvedores-do-discord)
- [Obtendo IDs no Discord (Modo do Desenvolvedor)](#-obtendo-ids-no-discord-modo-do-desenvolvedor)
- [Configuração do Arquivo `.env`](#-configuração-do-arquivo-env)
- [Como Executar o Bot](#-como-executar-o-bot)
- [Registrar Comandos de Barra (Slash Commands /)](#-registrar-comandos-de-barra-slash-commands-)
- [Usando o Painel Web (Dashboard)](#-usando-o-painel-web-dashboard)

---

## ✨ Funcionalidades
1. **Painel Web de Configuração (Dashboard)**:
   - Acessível em `http://localhost:3000`.
   - Monitoramento em tempo real do status da conexão do Bot e estatísticas.
   - Cadastro e remoção de matrículas permitidas (`data/matriculas.json`).
   - Disparo manual de Mensagens Diretas (DMs) de notificação ou boas-vindas.
2. **Motor Multi-Regras**:
   - Criação de regras personalizadas associando matrículas a servidores, canais e cargos específicos.
   - Suporte a filtros de canais autorizados ou liberação direta por DM no privado.
3. **Validação por Mensagem Direta (DM / Mensagem Privada)**:
   - O usuário envia uma mensagem privada para o Bot contendo sua matrícula.
   - O Bot valida o código e atribui o cargo automaticamente no servidor.
4. **Comando de Barra `/matricula`**:
   - Validação direta no canal oficial do servidor com resposta efêmera (visível apenas para quem executou).

---

## 🛠️ Passo a Passo: Criar e Configurar o Bot no Portal de Desenvolvedores do Discord

Siga o passo a passo com os termos oficiais da interface do Discord em **Português**:

### 1. Criar a Aplicação
1. Acesse o [Portal de Desenvolvedores do Discord (Discord Developer Portal)](https://discord.com/developers/applications).
2. Faça login com sua conta do Discord.
3. Clique no botão azul **"Nova Aplicação"** (*New Application*) no canto superior direito.
4. Digite o nome do seu bot (ex: `FlexBot`), aceite os Termos de Serviço e clique em **Criar** (*Create*).

### 2. Configurar o Bot e Gerar o Token
1. No menu lateral esquerdo, clique em **Bot**.
2. Na seção do bot, clique no botão **Redefinir Token** (*Reset Token*) ou **Copiar Token**.
3. Confirme e copie a chave gerada.
   > ⚠️ **ATENÇÃO:** Cole este Token no campo `DISCORD_TOKEN` do seu arquivo `.env`. Nunca compartilhe este token com ninguém.

### 3. Ativar as Intenções de Gateway Privilegiadas (OBRIGATÓRIO)
Para que o bot consiga adicionar cargos aos membros e ler mensagens diretas (DMs), você **deve ativar** estas opções no Portal:
1. Ainda na aba **Bot**, role a página para baixo até encontrar a seção **Intenções de Gateway Privilegiadas** (*Privileged Gateway Intents*).
2. Ative as chaves:
   - ✅ **Intenção de Membros do Servidor** (*Server Members Intent*) -> Permite gerenciar e atribuir cargos aos usuários.
   - ✅ **Intenção de Conteúdo da Mensagem** (*Message Content Intent*) -> Permite ler e responder as DMs privadas dos usuários.
3. Clique no botão verde **Salvar alterações** (*Save Changes*) no rodapé da página.

### 4. Gerar o Link de Convite para Adicionar o Bot ao seu Servidor
1. No menu lateral esquerdo, vá em **OAuth2** -> **Gerador de URL** (*URL Generator*).
2. Na caixa **Escopos** (*Scopes*), marque:
   - ✅ `bot`
   - ✅ `applications.commands`
3. Na caixa **Permissões do Bot** (*Bot Permissions*), marque:
   - ✅ **Administrador** (*Administrator*) ou **Gerenciar Cargos** (*Manage Roles*).
4. No final da página, copie o link gerado no campo **URL Gerada** (*Generated URL*).
5. Cole essa URL em uma nova aba do seu navegador, escolha o seu Servidor do Discord e clique em **Continuar** / **Autorizar**.

---

## ⚙️ Configuração do Arquivo `.env`

Abra o arquivo `.env` localizado na raiz do projeto e preencha com as suas credenciais:

```env
# Credenciais obrigatórias obtidas no Portal de Desenvolvedores do Discord
DISCORD_TOKEN=cole_seu_token_aqui
CLIENT_ID=cole_seu_client_id_aqui

# Porta da Dashboard Web (Padrão 3000)
PORT=3000
```

---

## 🚀 Como Executar o Bot

### Opção 1: Desenvolvimento Local (`npm run dev`)
Certifique-se de ter o Node.js v18+ instalado:

```bash
# 1. Instalar dependências (uma única vez)
npm install

# 2. Registrar os comandos Slash no Discord
npm run deploy-commands

# 3. Rodar em modo de desenvolvimento (com recarregamento automático ao editar arquivos)
npm run dev
```

---

### Opção 2: Produção com Docker Compose
Se preferir rodar via Docker:

```bash
docker compose up -d --build
```
Para verificar os logs de execução:
```bash
docker logs -f gusta-bot-app
```

---

## 🌐 Usando o Painel Web (Dashboard)

Após iniciar o bot, abra o seu navegador e acesse:

👉 **`http://localhost:3000`**

Recursos disponíveis no Painel Web:
- **Visão Geral**: Acompanhe se o FlexBot está `Online` e conectado ao seu servidor.
- **Regras & Cargos**: Crie e edite regras em tela cheia associando Servidor, Cargo e Canal específico.
- **Base de Matrículas**: Adicione ou remova números de matrícula da lista autorizada (`matriculas.json`) instantaneamente sem reiniciar a aplicação.
- **Envio de DMs**: Dispare mensagens privadas diretamente para a caixa de entrada de qualquer usuário pelo ID do Discord.
