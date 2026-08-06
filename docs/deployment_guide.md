# Guia de Implantação e Hospedagem (Deployment Guide) — FlexBot

Este documento explica por que plataformas estáticas como **GitHub Pages** e **Netlify** não conseguem rodar Bots de Discord e apresenta a solução para o Render.com com **Disco Persistente (Render Disk)**.

---

## ❌ 1. Posso usar GitHub Pages ou Netlify? (NÃO)

### 🔴 GitHub Pages
- **Servidor Estático**: O GitHub Pages apenas entrega arquivos estáticos (HTML/CSS/JS) para o navegador do cliente.
- **Sem Node.js**: O GitHub Pages **não executa código Node.js** e não consegue manter o processo do FlexBot conectado ao Discord.

### 🔴 Netlify / Vercel
- **Funções de Curta Duração**: O Netlify e o Vercel encerram qualquer execução após 10 a 26 segundos.

---

## 🟢 2. Hospedagem no Render.com (Como resolver erro de gravação)

No **Render.com**, para que o servidor consiga salvar e manter as matrículas e regras sem erros de permissão ou perda de dados quando o container reinicia:

### Configuração do Disco Persistente (Render Disk):

1. Acesse o seu **Web Service** no painel do **Render.com**.
2. No menu lateral esquerdo, clique em **Disks** -> **Add Disk**.
3. Configure o disco:
   - **Name**: `flexbot-data`
   - **Mount Path**: `/app/data`  *(ou `c:/projetos/flex-bot/data` em ambiente local)*
   - **Size**: `1 GB`
4. Clique em **Save Changes**.

> 💡 **Por que isso é necessário?** Por padrão no Render, o sistema de arquivos de um container Docker é efêmero (somente-leitura ou reiniciado a cada novo deploy). Adicionando o **Disk Mount Path `/app/data`**, todas as escritas em `matriculas.json`, `rules.json` e `dm_rules.json` serão **permanentes e gravadas com sucesso**!

---

### Passo a Passo para Criar o Serviço no Render:

1. Crie uma conta gratuita em [Render.com](https://render.com).
2. Conecte sua conta do GitHub e clique em **New +** -> **Web Service**.
3. Selecione o repositório **`flex-bot`**.
4. Configure as opções:
   - **Environment**: `Docker` (ele lerá o `Dockerfile` automaticamente).
   - **Plan**: `Free`.
5. Em **Environment Variables** (Variáveis de Ambiente), adicione:
   - `DISCORD_TOKEN`: *(Seu token do bot)*
   - `CLIENT_ID`: `1534658355228967042`
   - `PORT`: `3000`
6. Adicione o **Disk** no caminho `/app/data`.
7. Clique em **Create Web Service**.

---

### Option B: Hospedagem no Railway.app

1. Acesse [Railway.app](https://railway.app) e crie um projeto importando seu repositório do GitHub.
2. O Railway detectará o `docker-compose.yml` ou `Dockerfile` automaticamente e criará o volume de gravação.
3. Adicione as variáveis de ambiente (`DISCORD_TOKEN` e `CLIENT_ID`).
