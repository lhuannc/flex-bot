# Limitações do Sistema e Taxas de Concorrência (Rate Limits) — FlexBot

Este documento descreve as limitações técnicas, limites da API do Discord (Rate Limits), concorrência de acessos simultâneos e capacidades do **FlexBot**.

---

## ⚡ 1. Limites de Taxa da API do Discord (Discord Rate Limits)

O **FlexBot** interage diretamente com a API oficial do Discord. O Discord impõe limites rígidos para evitar spam e abuso de recursos:

| Operação | Limite do Discord | Comportamento do FlexBot |
|---|---|---|
| **Envio de Mensagens (Canais e DMs)** | Máx. 5 mensagens a cada 5 segundos por canal/DM | Respostas automáticas são enfileiradas pelo SDK `discord.js`. |
| **Atribuição de Cargos (`addRole`)** | Máx. ~10 atribuições a cada 10 segundos por servidor | Executado de forma assíncrona. Se excedido, o Discord retorna status `429 Too Many Requests` e o SDK aguarda a janela de redefinição. |
| **Disparo de DMs em Massa** | Recomenda-se intervalo de 1s a 2s entre envios | O envio massivo direto para múltiplos usuários sem interação pode acionar bloqueios temporários no token do bot. |
| **Criação de Comandos Slash (`/`)** | Máx. 200 comandos globais por dia | O FlexBot utiliza apenas comandos essenciais registrados na inicialização. |

---

## 👥 2. Acessos Simultâneos e Concorrência de Usuários

### 2.1 Navegação Simultânea na URA (Direct Messages)
- **Gerenciamento de Sessão**: As sessões ativas da URA são mantidas em memória (`Map` de `userId -> sessionData`).
- **Capacidade Simultânea**: O motor assíncrono em Node.js (Event Loop) suporta **milhares de usuários navegando simultaneamente** nas opções do menu de URA sem travamentos de I/O.
- **Volatilidade de Sessão**: Se o container for reiniciado enquanto um usuário está no meio de um fluxo (digitando a matrícula), a sessão transient é resetada. O usuário precisa apenas digitar `menu` ou `oi` para reiniciar a navegação. Todas as regras e árvores de URA cadastradas permanecem 100% salvas em `data/dm_rules.json`.

### 2.2 Dashboard Web (`http://localhost:3000`)
- Servidor web construído sobre **Express.js**.
- Suporta múltiplos administradores acessando o painel de controle simultaneamente.
- Requisições REST concorrentes para a base de dados em arquivo possuem travas assíncronas para leitura e escrita seguras em disco.

---

## 💾 3. Limites de Armazenamento e Performance em Disco

### 3.1 Base de Matrículas (`matriculas.json`)
- **Tamanho Recomendado**: Suporta até **500.000 matrículas** com busca em tempo de resposta inferior a **5ms** no Node.js.
- **Leitura em Memória**: A lista de matrículas é mantida em memória ram e sincronizada no disco.
- **Cadastro em Lote (Bulk Textarea)**: A API do Express aceita payloads de até **10 MB**, permitindo colar centenas de milhares de números de uma só vez sem estouro de memória.

---

## 🔐 4. Hierarquia e Permissões do Discord (Role Hierarchy)

Para que a atribuição automática de cargos funcione sem falhas:

1. **Permissão de Gerenciar Cargos**: O bot precisa da permissão `MANAGE_ROLES` (Gerenciar Cargos) habilitada no servidor.
2. **Posição na Hierarquia de Cargos**: O cargo próprio do **FlexBot** deve estar localizado **ACIMA** de todos os cargos que ele precisa atribuir na lista de cargos do Discord (Configurações do Servidor -> Cargos).
   - ⚠️ *Se o cargo do FlexBot estiver abaixo do cargo configurado na regra, o Discord retornará um erro `403 Forbidden (Missing Permissions)`.*

---

## 🛠️ 5. Recomendações de Uso em Produção

1. **Auto-deleção de mensagens em canais**: Mantenha o tempo de deleção das respostas em canais de texto entre **5s e 15s** para evitar poluição visual nos canais públicos.
2. **Backup periódico**: O diretório `./data/` pode ser copiado ou versionado em backup periódico.
3. **Escalabilidade Extrema**: Para servidores com mais de **1.000.000 de usuários ativos**, recomenda-se acoplar um banco Redis para cache de matrículas em tempo real.
