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

### 4.1 Como o Stoat calcula as permissões — o último cargo vence

> ⚠️ **Esta é a regra menos intuitiva do Stoat e a causa mais comum de "criei o cargo e não funcionou".** Ela **não** se comporta como o Discord, onde um `deny` normalmente prevalece.

O cálculo está em `node_modules/stoat.js/lib/permissions/calculator.js` e, para **cada cargo** do membro, aplica primeiro os *allows* e depois os *denies*:

```js
perm = (perm | BigInt(permission.a)) & ~BigInt(permission.d);
```

A ordem vem de `ServerMember.orderedRoles`, que ordena `.sort((a, b) => b.rank - a.rank)` — descrito na própria biblioteca como *"from lowest to highest priority"*. Como **rank menor = prioridade maior**, o cargo de rank menor é processado **por último**.

**Portanto: quando dois cargos discordam sobre o mesmo bit, vence o cargo de rank MENOR (mais acima na lista), seja ele um allow ou um deny.**

A ordem de aplicação completa é:

1. `defaultPermissions` do **servidor**;
2. cargos do membro, do rank maior para o menor;
3. `defaultPermissions` do **canal**;
4. overrides de cargo **do canal**, na mesma ordem de rank;
5. se o membro estiver em *timeout*, tudo é reduzido a `ALLOW_IN_TIMEOUT`.

> 💡 As etapas de canal rodam **depois** das de servidor. Misturar os dois níveis para a mesma permissão produz resultado confuso — defina cada permissão em **um nível só**.

### 4.2 Permissões de voz e o par COLABORADOR + VOZ

Permissões de voz do Stoat (valores em `permissions/definitions.js`):

| Permissão | Bit | Para quê |
|---|---|---|
| `Connect` | 1 << 30 | Entrar no canal de voz (ouvir) |
| `Speak` | 1 << 31 | **Transmitir áudio** |
| `Video` | 1 << 32 | Compartilhar vídeo/tela |
| `MuteMembers` | 1 << 33 | Mutar membros de rank inferior |
| `DeafenMembers` | 1 << 34 | Ensurdecer membros de rank inferior |
| `MoveMembers` | 1 << 35 | Mover membros entre canais de voz |

**Modelo adotado no projeto:** o cargo entregue pelo bot dá acesso, e um cargo separado dá voz.

| Cargo | Quem atribui | `Connect` | `Speak` |
|---|---|---|---|
| **COLABORADOR** | FlexBot, após validar a matrícula | ✅ permitido | ⬜ **em branco** (não concedido e **não negado**) |
| **VOZ** | Manualmente, pela administração | — | ✅ permitido |

Regras de montagem:

1. **Nunca use `deny` em `Speak` no COLABORADOR.** Deixe em branco. Se o COLABORADOR negar `Speak` e ficar **abaixo** do VOZ, o deny é aplicado por último e a pessoa continua muda **mesmo tendo o cargo VOZ** (ver §4.1).
2. Posicione **VOZ acima de COLABORADOR** de qualquer forma — protege o setup caso algum deny seja introduzido depois.
3. Configure ambos no **override do canal de voz**, não nas permissões globais.
4. Verifique o cargo padrão (`@everyone`): um `deny` de `Speak` ali entra na mesma disputa de ordem.
5. O merge de cargos do [`assignRoleToUser`](../services/stoatService.js) (`[...new Set([...currentRoles, roleId])]`) garante que conceder COLABORADOR **não apaga** o cargo VOZ de quem já o tem.

> ⚠️ **A permissão de voz é avaliada no momento da conexão.** Quem já está conectado ao canal quando a permissão muda permanece com o estado antigo — e o cliente trava o botão do microfone — até **sair e entrar de novo**. Não há solução por configuração; oriente os testadores a reconectar.

### 4.3 Estado do microfone ao entrar

O microfone ligado/desligado com que a pessoa entra é **estado do cliente**, salvo na máquina dela conforme o último uso. Não existe no Stoat um equivalente ao *"join muted"* de servidor do Discord, e nem o servidor nem o FlexBot definem isso.

O único controle server-side é o **mute de servidor por membro**, exposto no `DataMemberEdit` da rota `PATCH /servers/{server}/members/{member}`:

| Campo | Descrição na spec oficial |
|---|---|
| `can_publish` | "server-wide voice muted" |
| `can_receive` | "server-wide voice deafened" |
| `voice_channel` | canal de voz para onde mover, se já estiver em um |

`ServerMember.edit(data)` repassa esse payload, então seria utilizável pelo mesmo `PATCH` que já concede cargos. **O FlexBot não usa nenhum desses campos** — o projeto optou pelo modelo de dois cargos (§4.2). Se um dia for usado, atenção a três pontos:

- a **polaridade é ambígua** (campo chamado `can_publish`, descrito como *"whether the member is voice muted"*) e precisa de teste empírico;
- `HydratedServerMember` **não hidrata** esses campos — dá para escrever, não para reler pelo cache;
- exige `MuteMembers` no cargo do bot **e** rank acima do alvo.

---

## 🧱 5. Limitações Herdadas da Plataforma

| Recurso do Discord | Situação no Stoat | Impacto no FlexBot |
|---|---|---|
| Slash Commands (`/matricula`) | **Não existe** | Substituído por comandos de texto com prefixo (`!matricula`) |
| Respostas efêmeras (`ephemeral`) | **Não existe** | Em canais públicos, a mensagem do usuário é apagada e a resposta é auto-deletada após N segundos |
| Embeds com `fields` | Embeds suportam apenas `title`, `description`, `colour`, `url`, `icon_url`, `media` | O `!status` monta as estatísticas dentro do `description` em Markdown |
| Botões / menus de seleção (Components) | **Não existe** | A URA é navegada digitando o número da opção |
| Evento `voiceStateUpdate` | O WebSocket **envia** (`VoiceChannelJoin`, `VoiceChannelLeave`, `VoiceChannelMove`, `UserVoiceStateUpdate`), mas o `stoat.js` 7.3.6 **não reemite** — o handler em `events/v1.js` só atualiza o mapa interno e traz um comentário literal `// todo: event` | O bot **não consegue reagir a alguém entrando/saindo de um canal de voz**. Mutar automaticamente na entrada da voz é inviável nesta versão |
| Leitura de quem está na voz | **Disponível**: `Channel.isVoice`, `Channel.voiceParticipants` e a classe `VoiceParticipant` (`isPublishing()`, `isReceiving()`, `isScreensharing()`, `isCamera()`) | Consulta pontual funciona; o que falta é o gatilho por evento |

> 📌 Verificado contra **stoat.js 7.3.6** / **stoat-api 0.8.9-4** (agosto/2026). Reconfirme os itens de voz ao subir de versão — vários estão marcados como *todo* no upstream.

---

## 🛠️ 6. Recomendações de Uso em Produção

1. **Auto-deleção de mensagens em canais**: Mantenha o tempo de deleção das respostas em canais de texto entre **5s e 15s** para evitar poluição visual nos canais públicos.
2. **Backup periódico**: O diretório `./data/` pode ser copiado ou versionado em backup periódico.
3. **Node.js 22+ obrigatório**: O `stoat.js` exige **Node.js >= 22.15.0 em modo ES Module**. Versões anteriores falham na inicialização.
4. **Escalabilidade Extrema**: Para servidores com mais de **1.000.000 de usuários ativos**, recomenda-se acoplar um banco Redis para cache de matrículas em tempo real.
