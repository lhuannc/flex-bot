Atue como um Arquiteto de Software e Desenvolvedor Sênior Node.js. O objetivo é criar o MVP de um bot customizado para o Discord focado em validação de acessos corporativos.

O código gerado deve seguir estritamente as melhores práticas de Engenharia de Software, Clean Code e a arquitetura recomendada pela documentação oficial do discord.js (v14). Para esta fase de testes de viabilidade, NÃO usaremos integrações externas; a base de dados será um arquivo JSON local (Mock).

## 1. Diretrizes de Arquitetura e Melhores Práticas
- **Modularidade (Command & Event Handlers):** Proíbo a criação de um único arquivo `index.js` gigante. Implemente um sistema dinâmico de manipulação de comandos (Command Handler) e eventos (Event Handler). Cada comando e evento deve ter seu próprio arquivo em pastas separadas (`/commands` e `/events`).
- **Separation of Concerns (SoC):** A lógica de leitura da base de dados deve ser isolada em um serviço dedicado (`/services/databaseService.js`). O comando do Discord apenas chama este serviço, mantendo a regra de negócio separada da interface.
- **Segurança e Escopo (.env):** O arquivo principal deve carregar as variáveis `DISCORD_TOKEN`, `CLIENT_ID`, `GUILD_ID`, `ROLE_ID` e `ALLOWED_CHANNEL_ID` a partir de um arquivo `.env`. 
- **Intents:** Configure os `Intents` no arquivo principal solicitando APENAS o estritamente necessário para rodar Slash Commands em um servidor.

## 2. Requisitos da Base de Dados (Mock)
- A fonte da verdade para este MVP será um arquivo estático localizado em `/data/matriculas.json`.
- O arquivo JSON deve conter apenas um array simples de strings simulando as matrículas (ex: `["12345678", "87654321", "11223344", "40123456"]`).

## 3. Fluxo de Execução (Behavior-Driven Development - BDD)
O bot terá apenas um Slash Command chamado `/matricula`, que exigirá um parâmetro numérico (String) obrigatório chamado `numero`.

- DADO QUE o usuário interage enviando `/matricula [numero_de_8_digitos]`
- QUANDO o Event Handler de interações receber o comando
- ENTÃO o bot deve imediatamente usar `interaction.deferReply({ ephemeral: true })` para garantir tempo de processamento e manter a interação invisível para os outros membros do servidor.
- E o bot deve verificar se `interaction.channel.id` é igual à variável `ALLOWED_CHANNEL_ID`.
   - SE o canal estiver incorreto: Retornar (editReply) a mensagem: "⚠️ Este comando só pode ser utilizado no canal de validação oficial." e encerrar a execução.
- SE o canal estiver correto, o bot deve chamar o `databaseService` para verificar se o número existe no array do arquivo JSON.
- SE a matrícula for validada com sucesso:
   - O bot deve atribuir a Role (cargo) ao usuário usando a variável `ROLE_ID`.
   - O bot deve editar a resposta (editReply) com: "✅ **Acesso Liberado!** Sua matrícula foi validada com sucesso."
- SE a matrícula não constar no arquivo JSON:
   - O bot deve editar a resposta com: "❌ **Matrícula não encontrada.** Verifique se você digitou os 8 números corretamente ou procure a coordenação."

## 4. Entregáveis
Gere o código completo para os seguintes arquivos, incluindo comentários explicativos de fluxo:
1. `index.js` (Ponto de entrada)
2. `deploy-commands.js` (Script de registro dos comandos)
3. Estrutura do Command Handler (ex: `/commands/matricula.js`)
4. Estrutura do Event Handler (ex: `/events/ready.js` e `/events/interactionCreate.js`)
5. O serviço isolado (`/services/databaseService.js`)
6. O arquivo mock (`/data/matriculas.json`)
7. O `.env.example` e o `package.json` configurado.