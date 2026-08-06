Atue como um Arquiteto de Software e Desenvolvedor Sênior Node.js. O objetivo é criar um bot customizado para o Discord focado em validação de acessos via Google Sheets.

Como Product Owner, exijo que o código gerado siga estritamente as melhores práticas de Engenharia de Software, Clean Code e a arquitetura recomendada pela documentação oficial do discord.js (v14).

## 1. Diretrizes de Arquitetura e Melhores Práticas
- **Modularidade (Command & Event Handlers):** Proíbo a criação de um único arquivo `index.js` gigante. Implemente um sistema de manipulação de comandos (Command Handler) e eventos (Event Handler) onde cada comando (ex: `/matricula`) e cada evento (ex: `ready`, `interactionCreate`) tenha seu próprio arquivo em pastas separadas (`/commands` e `/events`).
- **Separation of Concerns (SoC):** A lógica de conexão e leitura do Google Sheets deve ser isolada em um serviço dedicado (ex: `/services/googleSheetsService.js`). O comando do Discord apenas chama este serviço, não executa a regra de negócio do Google diretamente.
- **Segurança e Escopo:** Utilize variáveis de ambiente (.env) para todas as credenciais. Configure os `Intents` do Discord no arquivo principal solicitando APENAS o estritamente necessário para Slash Commands (não solicite intents privilegiados de leitura de mensagens se não for usar).
- **Tratamento de Erros:** Implemente blocos `try/catch` robustos. Em caso de falha da API do Google, o bot deve capturar o erro silenciosamente no console e retornar uma resposta efêmera amigável para o usuário.

## 2. Requisitos de Negócio e Base de Dados
- A fonte da verdade é uma planilha do Google Sheets com cerca de 3.000 matrículas numéricas (todas com exatamente 8 dígitos) na coluna A. A autenticação será via Google Service Account (credentials.json).
- O comando principal será o Slash Command `/matricula`, que exigirá um parâmetro numérico (String) obrigatório.

## 3. Fluxo de Execução (Behavior-Driven)
- DADO QUE o usuário interage enviando `/matricula [numero_de_8_digitos]`
- QUANDO o Event Handler de interações receber o comando
- ENTÃO o bot deve usar `interaction.deferReply({ ephemeral: true })` para garantir tempo de processamento sem timeout da API do Discord.
- E o bot deve chamar o serviço do Google Sheets para validar a existência do número.
- SE a matrícula for validada com sucesso:
   - O bot deve atribuir a Role (cargo) parametrizada nas variáveis de ambiente.
   - O bot deve editar a resposta (editReply) com: "✅ Acesso Liberado! Sua matrícula foi validada."
- SE a matrícula não constar na base:
   - O bot deve editar a resposta com: "❌ Matrícula não encontrada. Verifique os números ou procure a coordenação."

Gere a estrutura de pastas proposta, os arquivos de inicialização, os handlers de comandos e eventos, o serviço do Google Sheets, o script de deploy dos comandos (`deploy-commands.js`) e o `package.json`. Inclua comentários explicando o fluxo.
