Atue como um Arquiteto de Software e Desenvolvedor Sênior Node.js. O objetivo é criar o MVP de um bot customizado para o **Stoat** (plataforma de chat open-source, antiga Revolt) focado em validação de acessos corporativos.

O código gerado deve seguir estritamente as melhores práticas de Engenharia de Software, Clean Code e a arquitetura recomendada pela documentação oficial do **stoat.js (v7)**. Para esta fase de testes de viabilidade, NÃO usaremos integrações externas; a base de dados será um arquivo JSON local (Mock).

## 0. Requisitos de Runtime (Obrigatórios)
- **Node.js >= 22.15.0** e **modo ES Module** (`"type": "module"` no `package.json`). O `stoat.js` não funciona em CommonJS nem em Node.js 20.
- Todos os arquivos devem usar `import` / `export` (nunca `require`).

## 1. Diretrizes de Arquitetura e Melhores Práticas
- **Modularidade (Command & Event Handlers):** Proíbo a criação de um único arquivo `index.js` gigante. Implemente um sistema dinâmico de manipulação de comandos (Command Handler) e eventos (Event Handler) via `import()` dinâmico. Cada comando e evento deve ter seu próprio arquivo em pastas separadas (`/commands` e `/events`).
- **Separation of Concerns (SoC):** A lógica de leitura da base de dados deve ser isolada em um serviço dedicado (`/services/databaseService.js`). O comando apenas chama este serviço, mantendo a regra de negócio separada da interface.
- **Fronteira única com a plataforma:** Nenhum módulo além de `/services/stoatService.js` deve importar o `stoat.js` diretamente. Toda chamada à API do Stoat (buscar servidor, cargo, membro, abrir DM) passa por esse serviço.
- **Segurança e Escopo (.env):** O arquivo principal deve carregar as variáveis `STOAT_TOKEN`, `STOAT_API_URL`, `COMMAND_PREFIX`, `SERVER_ID`, `ROLE_ID` e `ALLOWED_CHANNEL_ID` a partir de um arquivo `.env`.
- **Instância configurável:** O cliente deve ser instanciado como `new Client({ baseURL: process.env.STOAT_API_URL || 'https://stoat.chat/api' })`, permitindo apontar para instâncias self-hosted.

## 2. Requisitos da Base de Dados (Mock)
- A fonte da verdade para este MVP será um arquivo estático localizado em `/data/matriculas.json`.
- O arquivo JSON deve conter apenas um array simples de strings simulando as matrículas (ex: `["12345678", "87654321", "11223344", "40123456"]`).

## 3. Fluxo de Execução (Behavior-Driven Development - BDD)

⚠️ **O Stoat não possui Slash Commands nem API de *interactions*.** O bot terá um comando de **texto** chamado `matricula`, acionado pelo prefixo definido em `COMMAND_PREFIX` (padrão `!`), que exige um argumento numérico obrigatório.

- DADO QUE o usuário envia `!matricula [numero_de_8_digitos]`
- QUANDO o Event Handler do evento `messageCreate` receber a mensagem
- ENTÃO o bot deve ignorar mensagens de outros bots e de si mesmo (`message.author.bot`, `message.authorId === client.user.id`)
- E o bot deve verificar se `message.channel.id` é igual à variável `ALLOWED_CHANNEL_ID`.
   - SE o canal estiver incorreto: Responder "⚠️ Este comando só pode ser utilizado no canal de validação oficial." e encerrar a execução.
- SE o canal estiver correto, o bot deve chamar o `databaseService` para verificar se o número existe no array do arquivo JSON.
- COMO o Stoat não possui respostas efêmeras (`ephemeral`), o bot deve **apagar a mensagem original do usuário** (`message.delete()`) e **auto-deletar a própria resposta** após N segundos, mantendo o canal limpo.
- SE a matrícula for validada com sucesso:
   - O bot deve atribuir a Role (cargo) ao usuário usando a variável `ROLE_ID`.
   - ⚠️ A API do Stoat **substitui a lista inteira de cargos** no `PATCH`. Portanto, buscar o membro (`server.fetchMember`), **mesclar** o cargo novo com os atuais e só então chamar `member.edit({ roles: [...] })`.
   - O bot deve responder: "✅ **Acesso Liberado!** Sua matrícula foi validada com sucesso."
- SE a matrícula não constar no arquivo JSON:
   - O bot deve responder: "❌ **Matrícula não encontrada.** Verifique se você digitou os 8 números corretamente ou procure a coordenação."

## 4. Entregáveis
Gere o código completo para os seguintes arquivos, incluindo comentários explicativos de fluxo:
1. `index.js` (Ponto de entrada — cria o `Client`, carrega comandos/eventos e faz `client.loginBot(process.env.STOAT_TOKEN)`)
2. Estrutura do Command Handler (ex: `/commands/matricula.js`)
3. Estrutura do Event Handler (ex: `/events/ready.js` e `/events/messageCreate.js`)
4. O serviço isolado de dados (`/services/databaseService.js`)
5. O adaptador da plataforma (`/services/stoatService.js`)
6. O arquivo mock (`/data/matriculas.json`)
7. O `.env.example` e o `package.json` configurado com `"type": "module"` e `engines.node >= 22.15.0`.

> 🚫 **NÃO gere** um `deploy-commands.js`. Esse script existia apenas para registrar Slash Commands na API do Discord e não tem equivalente no Stoat.
