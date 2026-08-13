Atue como um Arquiteto de Software e Desenvolvedor Sênior Node.js. O objetivo é criar um bot customizado para o **Stoat** (plataforma de chat open-source, antiga Revolt) focado em validação de acessos via Google Sheets.

Como Product Owner, exijo que o código gerado siga estritamente as melhores práticas de Engenharia de Software, Clean Code e a arquitetura recomendada pela documentação oficial do **stoat.js (v7)**.

## 0. Requisitos de Runtime (Obrigatórios)
- **Node.js >= 22.15.0** e **modo ES Module** (`"type": "module"`). O `stoat.js` não funciona em CommonJS nem em Node.js 20.
- Todos os arquivos devem usar `import` / `export` (nunca `require`).

## 1. Diretrizes de Arquitetura e Melhores Práticas
- **Modularidade (Command & Event Handlers):** Proíbo a criação de um único arquivo `index.js` gigante. Implemente um sistema de manipulação de comandos (Command Handler) e eventos (Event Handler) onde cada comando (ex: `!matricula`) e cada evento (ex: `ready`, `messageCreate`) tenha seu próprio arquivo em pastas separadas (`/commands` e `/events`).
- **Separation of Concerns (SoC):** A lógica de conexão e leitura do Google Sheets deve ser isolada em um serviço dedicado (ex: `/services/googleSheetsService.js`). O comando apenas chama este serviço, não executa a regra de negócio do Google diretamente.
- **Fronteira única com a plataforma:** Nenhum módulo além de `/services/stoatService.js` deve importar o `stoat.js` diretamente.
- **Segurança e Escopo:** Utilize variáveis de ambiente (.env) para todas as credenciais (`STOAT_TOKEN`, `STOAT_API_URL`, `COMMAND_PREFIX`).
- **Permissões:** O Stoat não usa "Intents" como o Discord — o bot recebe todos os eventos dos servidores em que está presente. O controle é feito por **permissões de cargo** no servidor (`AssignRoles`, `SendMessage`, `ManageMessages`, `SendEmbeds`). Documente essas permissões no README.
- **Tratamento de Erros:** Implemente blocos `try/catch` robustos. Em caso de falha da API do Google, o bot deve capturar o erro no console e retornar uma resposta amigável ao usuário.

## 2. Requisitos de Negócio e Base de Dados
- A fonte da verdade é uma planilha do Google Sheets com cerca de 3.000 matrículas numéricas (todas com exatamente 8 dígitos) na coluna A. A autenticação será via Google Service Account (credentials.json).
- O comando principal será o comando de texto `!matricula` (prefixo configurável via `COMMAND_PREFIX`), que exigirá um argumento numérico obrigatório.

> ⚠️ **O Stoat não possui Slash Commands nem API de *interactions*.** Os comandos são interpretados a partir do conteúdo da mensagem no evento `messageCreate`.

## 3. Fluxo de Execução (Behavior-Driven)
- DADO QUE o usuário interage enviando `!matricula [numero_de_8_digitos]`
- QUANDO o Event Handler de `messageCreate` receber a mensagem
- ENTÃO o bot deve ignorar mensagens de bots e de si mesmo, e identificar o prefixo e o nome do comando
- E o bot deve chamar o serviço do Google Sheets para validar a existência do número.
- COMO não existem respostas efêmeras no Stoat, o bot deve apagar a mensagem original e auto-deletar a própria resposta após N segundos em canais públicos.
- SE a matrícula for validada com sucesso:
   - O bot deve atribuir a Role (cargo) parametrizada nas variáveis de ambiente.
   - ⚠️ A API do Stoat **substitui a lista inteira de cargos** no `PATCH /servers/:id/members/:user`. Busque o membro, **mescle** o cargo novo com os atuais e então chame `member.edit({ roles: [...] })`.
   - O bot deve responder com: "✅ Acesso Liberado! Sua matrícula foi validada."
- SE a matrícula não constar na base:
   - O bot deve responder com: "❌ Matrícula não encontrada. Verifique os números ou procure a coordenação."

## 4. Entregáveis
Gere a estrutura de pastas proposta, os arquivos de inicialização, os handlers de comandos e eventos, o serviço do Google Sheets, o adaptador `stoatService.js` e o `package.json` (com `"type": "module"` e `engines.node >= 22.15.0`). Inclua comentários explicando o fluxo.

> 🚫 **NÃO gere** um `deploy-commands.js` — não há registro de comandos na API do Stoat.
