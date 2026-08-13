# Limitações do Sistema e Taxas de Concorrência (Rate Limits) — FlexBot

Este documento descreve as limitações técnicas, limites da API do Stoat (Rate Limits), concorrência de acessos simultâneos e capacidades do **FlexBot**.

---

## ⚡ 1. Limites de Taxa da API do Stoat

O **FlexBot** interage diretamente com a API oficial do Stoat. A plataforma aplica limites por rota (respondidos com o status `429 Too Many Requests` e cabeçalhos `X-RateLimit-*`) para evitar spam e abuso de recursos:

| Operação | Comportamento do Stoat | Comportamento do FlexBot |
|---|---|---|
| **Envio de Mensagens (Canais e DMs)** | Limite por bucket de rota (`/channels/:id/messages`); excedentes recebem `429` com `Retry-After` | Respostas automáticas são enviadas de forma assíncrona; falhas são capturadas e registradas no log sem derrubar o bot |
| **Atribuição de Cargos (`PATCH /servers/:id/members/:user`)** | Limite por bucket de servidor | Executado de forma assíncrona e idempotente — se o usuário já possui o cargo, nenhuma chamada é feita |
| **Disparo de DMs em Massa** | Abrir muitas DMs em sequência pode acionar bloqueios temporários | O broadcast aplica **delay fixo de 1,2s entre envios** (`broadcastToExistingMembers`) |
| **Abertura de DM (`user.openDM()`)** | Cria/reutiliza o canal `DirectMessage` | Falhas (usuário bloqueou DMs) são tratadas silenciosamente e contabilizadas no relatório de disparo |

> ℹ️ **Diferença importante em relação ao Discord:** o Stoat **não possui Slash Commands** nem limite de "200 comandos globais por dia" — não há registro de comandos na plataforma. Os comandos do FlexBot são de texto, interpretados localmente no evento `messageCreate`, e portanto **não consomem nenhuma cota da API**.

### Substituição de cargos no PATCH

A API do Stoat **substitui a lista inteira de cargos** do membro a cada `PATCH`. O `stoatService.assignRoleToUser()` por isso:
1. Busca o membro (`server.fetchMember`);
2. Mescla o cargo novo com os cargos atuais (`[...new Set([...currentRoles, roleId])]`);
3. Envia a lista completa.

⚠️ Ignorar essa mesclagem **apagaria todos os outros cargos do usuário**.

---

## 👥 2. Acessos Simultâneos e Concorrência de Usuários

### 2.1 Navegação Simultânea na URA (Direct Messages)
- **Gerenciamento de Sessão**: As sessões ativas da URA são mantidas em memória (`Map` de `userId -> sessionData`).
- **Capacidade Simultânea**: O motor assíncrono em Node.js (Event Loop) suporta **milhares de usuários navegando simultaneamente** nas opções do menu de URA sem travamentos de I/O.
- **Volatilidade de Sessão**: Se o container for reiniciado enquanto um usuário está no meio de um fluxo (digitando a matrícula), a sessão transiente é resetada. O usuário precisa apenas digitar `menu` ou `oi` para reiniciar a navegação. Todas as regras e árvores de URA cadastradas permanecem 100% salvas em `data/dm_rules.json`.

### 2.2 Reconexão do WebSocket
- O `stoat.js` possui **reconexão automática** habilitada por padrão (`autoReconnect: true`), com *backoff* exponencial.
- Durante a queda, o `index.js` marca o bot como offline (evento `disconnected`) e o Dashboard exibe o status desconectado até a reconexão.

### 2.3 Dashboard Web (`http://localhost:3000`)
- Servidor web construído sobre **Express.js**.
- Suporta múltiplos administradores acessando o painel de controle simultaneamente.
- Requisições REST concorrentes para a base de dados em arquivo são serializadas por escritas síncronas (`fs.writeFileSync`), garantindo consistência do JSON em disco.

---

## 💾 3. Limites de Armazenamento e Performance em Disco

### 3.1 Base de Matrículas (`matriculas.json`)
- **Tamanho Recomendado**: Suporta até **500.000 matrículas** com busca em tempo de resposta inferior a **5ms** no Node.js.
- **Cadastro em Lote (Bulk Textarea)**: A API do Express aceita payloads de até **10 MB**, permitindo colar centenas de milhares de números de uma só vez sem estouro de memória.

---

## 🔐 4. Hierarquia e Permissões do Stoat (Role Rank)

Para que a atribuição automática de cargos funcione sem falhas:

1. **Permissão de Atribuir Cargos**: O bot precisa da permissão `AssignRoles` (Gerenciar/Atribuir Cargos) habilitada no servidor.
2. **Posição na Hierarquia (`rank`)**: No Stoat cada cargo possui um **`rank` numérico**, e **quanto menor o número, maior a prioridade**.
   - O cargo do **FlexBot** deve ter `rank` **menor** (portanto, estar acima na lista) do que todos os cargos que ele precisa atribuir.
   - ⚠️ *Se o cargo do FlexBot estiver abaixo do cargo configurado na regra, a API do Stoat recusará a operação por falta de permissão.*
3. **Auto-deleção de mensagens**: exige a permissão `ManageMessages` no canal de validação.

---

## 🧱 5. Limitações Herdadas da Plataforma

| Recurso do Discord | Situação no Stoat | Impacto no FlexBot |
|---|---|---|
| Slash Commands (`/matricula`) | **Não existe** | Substituído por comandos de texto com prefixo (`!matricula`) |
| Respostas efêmeras (`ephemeral`) | **Não existe** | Em canais públicos, a mensagem do usuário é apagada e a resposta é auto-deletada após N segundos |
| Embeds com `fields` | Embeds suportam apenas `title`, `description`, `colour`, `url`, `icon_url`, `media` | O `!status` monta as estatísticas dentro do `description` em Markdown |
| Botões / menus de seleção (Components) | **Não existe** | A URA é navegada digitando o número da opção |

---

## 🛠️ 6. Recomendações de Uso em Produção

1. **Auto-deleção de mensagens em canais**: Mantenha o tempo de deleção das respostas em canais de texto entre **5s e 15s** para evitar poluição visual nos canais públicos.
2. **Backup periódico**: O diretório `./data/` pode ser copiado ou versionado em backup periódico.
3. **Node.js 22+ obrigatório**: O `stoat.js` exige **Node.js >= 22.15.0 em modo ES Module**. Versões anteriores falham na inicialização.
4. **Escalabilidade Extrema**: Para servidores com mais de **1.000.000 de usuários ativos**, recomenda-se acoplar um banco Redis para cache de matrículas em tempo real.
