# Identidade Visual — FlexBot

Padrão de identidade visual do FlexBot, derivado da implementação real em `web/public/style.css`,
`web/public/index.html` e `web/public/login.html`. Este é o documento **normativo**: qualquer tela, componente
ou mensagem nova deve seguir o que está aqui.

Base institucional: **Prefeitura do Rio (2025)** — estrutura de sidebar azul-institucional com área de conteúdo clara.

> Para a anatomia das telas e o mapa de navegação, veja [`layout.md`](./layout.md).

---

## 1. Fundamentos da Marca

### 1.1 Assinatura

| Elemento | Especificação |
|---|---|
| Nome | **FlexBot** — sempre em caixa alta no wordmark da sidebar (`text-transform: uppercase`) |
| Símbolo | Ícone `fa-landmark` (prédio institucional) em bloco 48×48px, `border-radius: 10px`, fundo `--gradient-cyan`, ícone branco 1.6rem |
| Sombra do símbolo | `0 4px 14px rgba(66, 185, 235, 0.4)` |
| Wordmark | `--font-heading`, 1.3rem, peso 900, `letter-spacing: -0.03em` |

### 1.2 O triângulo-ponto

Elemento de assinatura da identidade. Um triângulo ciano rotacionado 90° que funciona como **ponto final**
de todo título. É o detalhe que amarra a marca visualmente — **não deve ser omitido em títulos novos**.

```html
<h3>Título da Seção<span class="triangulo-ponto"></span></h3>
```

```css
.triangulo-ponto {
  display: inline-block;
  width: 0; height: 0;
  border-left: 7px solid transparent;
  border-right: 7px solid transparent;
  border-bottom: 12px solid var(--color-accent-cyan);
  transform: rotate(90deg);
  margin-left: 4px;
}
```

**Onde aplicar:** wordmark da sidebar, `#page-title`, todo `h3` de `.card-header`.
**Onde não aplicar:** `h4`/`h5` internos, rótulos de formulário, textos corridos, botões.

---

## 2. Paleta de Cores

### 2.1 Cores institucionais (tokens)

| Token | Hex | Papel |
|---|---|---|
| `--color-primary` | `#13335a` | **Azul institucional.** Sidebar, títulos, texto principal, estado ligado do switch |
| `--color-primary-dark` | `#0d223d` | Variação escura para hovers e profundidade |
| `--color-gradient-blue-mid` | `#2a688f` | Azul médio. Ícones de destaque, bordas em foco, scrollbar |
| `--color-accent-cyan` | `#42b9eb` | **Ciano vibrante.** Cor de acento — item ativo, indicadores, triângulo-ponto |
| `--color-neutral-light` | `#eceded` | Texto sobre fundo azul (sidebar) |
| `--color-neutral-bg` | `#f4f6f9` | Fundo da área de conteúdo |
| `--color-white` | `#ffffff` | Fundo de cards e campos |
| `--color-text-dark` | `#13335a` | Texto principal sobre fundo claro |
| `--color-text-muted` | `#475569` | Texto secundário, descrições, rótulos inativos |
| `--color-border-light` | `rgba(19,51,90,.12)` | Borda padrão de todos os cards e divisores |

### 2.2 Degradês

| Token | Valor | Aplicação |
|---|---|---|
| `--gradient-institucional` | `linear-gradient(135deg, #13335a 0%, #2a688f 100%)` | Botão primário |
| `--gradient-cyan` | `linear-gradient(135deg, #2a688f 0%, #42b9eb 100%)` | Logo, badge do passo ativo |
| Fundo do login | `linear-gradient(135deg, #0f2744 0%, #13335a 50%, #1e4a7a 100%)` | Exclusivo da tela de login |

O ângulo do degradê é **sempre 135°**. Não inverter a direção nem trocar a ordem das paradas.

### 2.3 Cores de status

| Token | Hex | Uso | Variante de texto |
|---|---|---|---|
| `--color-success` | `#10b981` | Passo concluído, badge de sucesso | `#047857` sobre `rgba(16,185,129,.15)` |
| `--color-warning` | `#d97706` | Avisos, badge de atenção | `#b45309` sobre `rgba(217,119,6,.15)` |
| `--color-danger` | `#ef4444` | Erros, ações destrutivas | `#dc2626` sobre `rgba(239,68,68,.1)` |
| Ciano (info) | `#42b9eb` | Badge informativo, borda do toast de sucesso | `#0284c7` sobre `rgba(66,185,235,.15)` |

### 2.4 Neutros de superfície

Valores usados diretamente no CSS (não tokenizados) — **use exatamente estes**, não invente cinzas novos:

| Hex | Aplicação |
|---|---|
| `#fafbfc` | Fundo de `.card-header` |
| `#f8fafc` | Blocos internos: `.action-block`, `.ivr-box`, `.rule-item`, `.trigger-option` |
| `#f1f5f9` | Cabeçalho de tabela (`th`) |
| `#eff6ff` | Fundo do `.trigger-option` selecionado |
| `#e2e8f0` | Badge neutro, badge de passo inativo, conector de passo, trilha da scrollbar |
| `#cbd5e1` | Switch desligado |
| `rgba(19,51,90,.02)` | Hover de linha de tabela |

### 2.5 Regras de contraste

- **Sidebar (fundo `#13335a`):** texto em `--color-neutral-light` a 85% de opacidade; ativo em `--color-accent-cyan`; rótulos de seção em `rgba(255,255,255,.5)`.
- **Conteúdo (fundo `#f4f6f9`):** texto em `--color-primary`; secundário em `--color-text-muted`.
- **Nunca** use ciano `#42b9eb` como cor de texto sobre fundo branco — o contraste é insuficiente. Sobre claro, use `#0284c7` ou `--color-gradient-blue-mid`.

---

## 3. Tipografia

### 3.1 Famílias

| Token | Pilha | Uso |
|---|---|---|
| `--font-family` | `'Cera Pro', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif` | Texto corrido, formulários, botões |
| `--font-heading` | `'Cera Pro Black', 'Outfit', sans-serif` | Títulos, números de destaque, cabeçalho de tabela |

**Cera Pro** é a fonte institucional da Prefeitura do Rio, usada quando instalada localmente. Na web, a
substituta efetiva é **Inter** (corpo) e **Outfit** (títulos), carregadas do Google Fonts em `index.html`.

`--tracking-display: -0.03em` — aplicar em todo texto na fonte de display com 1.3rem ou mais.

### 3.2 Escala

| Elemento | Fonte | Tamanho | Peso | Tracking |
|---|---|---|---|---|
| `h1` `#page-title` | heading | 2.1rem | 900 | -0.03em |
| Valor de estatística `.stat-value` | heading | 1.8rem | 900 | -0.03em |
| Wordmark da sidebar | heading | 1.3rem | 900 | -0.03em |
| `h3` de card | heading | 1.25rem | 800 | — |
| `h4` de regra `.rule-info h4` | heading | 1.1rem | 800 | — |
| Badge de passo | heading | 1.1rem | 900 | — |
| `h4` da caixa de URA | heading | 1.05rem | — | — |
| Subtítulo da página | corpo | 0.95rem | — | — |
| Campo de formulário | corpo | 0.95rem | 500 | — |
| Título do passo `.step-title` | heading | 0.95rem | 800 | — |
| Item de navegação `.nav-btn` | corpo | 0.92rem | 600 (700 ativo) | — |
| Rótulo de formulário | corpo | 0.9rem | 700 | — |
| Célula de tabela | corpo | 0.9rem | — | — |
| Botão `.btn` | corpo | 0.88rem | 700 | 0.5px, caixa alta |
| Rótulo de estatística | corpo | 0.85rem | — | — |
| Descrição de gatilho | corpo | 0.82rem | — | linha 1.5 |
| Texto auxiliar `small` | corpo | 0.78rem | — | — |
| Cabeçalho de tabela `th` | heading | 0.75rem | 800 | 0.8px, caixa alta |
| Badge | corpo | 0.75rem | 700 | caixa alta |
| Rótulo de seção da nav | corpo | 0.7rem | 800 | 1px, caixa alta |

### 3.3 Caixa alta

Reservada para: botões, badges, cabeçalho de tabela, rótulos de seção da navegação e o wordmark.
**Nunca** em títulos de página, títulos de card ou texto corrido.

---

## 4. Grid, Espaçamento e Elevação

### 4.1 Estrutura

| Medida | Valor |
|---|---|
| Largura da sidebar | `290px` (fixa) |
| Padding da sidebar | `28px 20px` |
| Padding do conteúdo | `36px 44px` |
| Largura máxima de formulário em coluna | `600px` |
| Quebra de `.form-row` | `repeat(auto-fit, minmax(280px, 1fr))` |
| Quebra de `.stats-grid` | `repeat(auto-fit, minmax(240px, 1fr))` |

### 4.2 Ritmo de espaçamento

Escala em uso: **4 · 8 · 10 · 12 · 14 · 16 · 20 · 24 · 28 · 32px**. Referências:

| Contexto | Valor |
|---|---|
| Gap entre rótulo e campo | `8px` |
| Gap entre itens de navegação | `8px` |
| Gap entre badges | `8px` |
| Gap de grid (`.form-row`, `.stats-grid`) | `20px` |
| Gap entre campos de um formulário | `20px` |
| Gap entre cards de um passo | `24px` |
| Padding de `.card-body` | `28px` |
| Padding de `.card-header` | `24px 28px` |
| Margem inferior de card / stepper | `32px` |

### 4.3 Raios

| Token | Valor | Aplicação |
|---|---|---|
| `--radius-sm` | `6px` | Botões, campos, `.ivr-option-card` |
| `--radius-md` | `10px` | Blocos internos, logo, toast, `.action-block` |
| `--radius-lg` | `14px` | Cards de conteúdo, stepper, cards de estatística |
| — | `20px` | Badges (pílula) |
| — | `50%` | Badge de passo, indicador de status, botão do switch |

### 4.4 Sombras

| Token | Valor | Uso |
|---|---|---|
| `--shadow-main` | `0 4px 20px rgba(19,51,90,.08)` | Repouso de todos os cards |
| `--shadow-hover` | `0 8px 28px rgba(19,51,90,.14)` | Hover de card elevável |
| — | `4px 0 20px rgba(19,51,90,.2)` | Sombra lateral da sidebar |
| — | `0 4px 14px rgba(19,51,90,.25)` | Botão primário em repouso |
| — | `0 6px 18px rgba(19,51,90,.35)` | Botão primário em hover |
| — | `0 4px 14px rgba(66,185,235,.4)` | Glow ciano: logo e badge do passo ativo |
| — | `0 10px 25px rgba(0,0,0,.25)` | Toast |

Toda sombra é **azulada** (`rgba(19,51,90,…)`), nunca preta neutra — exceto o toast e o card de login.

### 4.5 Movimento

| Transição | Duração |
|---|---|
| Padrão (hover, cor, borda) | `0.2s ease` |
| Switch, badge de passo, toast | `0.3s ease` |
| Entrada de aba e de painel do wizard | `fadeIn 0.3s ease` — `opacity 0→1` + `translateY(8px→0)` |
| Elevação em hover | `translateY(-1px)` botão · `translateY(-2px)` card |

---

## 5. Iconografia

**Biblioteca:** Font Awesome 6, estilo **Solid** (`fa-solid`). Não misturar estilos (`fa-regular`, `fa-brands`)
exceto o logotipo do Google na tela de login, que é um SVG inline com as cores oficiais da Google.

### 5.1 Vocabulário semântico em uso

| Ícone | Significado |
|---|---|
| `fa-landmark` | Marca FlexBot / instituição |
| `fa-hashtag` | Canal de texto |
| `fa-paper-plane` | Mensagem direta / envio |
| `fa-database` | Base de matrículas |
| `fa-broom` | Limpeza de cargos |
| `fa-envelope-open-text` | DM avulsa |
| `fa-building` | Servidor |
| `fa-bolt` | Gatilho ("Quando") |
| `fa-wand-magic-sparkles` | Consequências ("Então") |
| `fa-sitemap` | Árvore da URA |
| `fa-list-ol` | Opções numeradas do menu |
| `fa-list-check` | Regras cadastradas |
| `fa-circle-check` | Revisão / conclusão |
| `fa-floppy-disk` | Salvar |
| `fa-plus` / `fa-plus-circle` | Adicionar |
| `fa-trash` / `fa-eraser` | Excluir |
| `fa-lock-open` | Liberar matrícula |
| `fa-user-minus` | Remover cargo do membro |
| `fa-users` | Membros |
| `fa-bullhorn` | Comunicado em massa |
| `fa-magnifying-glass` | Busca |
| `fa-filter-circle-xmark` | Limpar filtro |
| `fa-arrows-rotate` | Atualizar dados |
| `fa-arrow-left` / `fa-arrow-right` | Navegação do wizard |
| `fa-circle-user` | Sessão autenticada |
| `fa-right-from-bracket` | Sair |
| `fa-shield-halved` | Segurança (rodapé do login) |

### 5.2 Regras

- Ícone de `h3` em card de wizard: cor `var(--color-gradient-blue-mid)`.
- Ícone de `h3` em card de dados: herda `--color-primary`.
- Ícone dentro de botão: sempre **antes** do texto, com gap de `8px`.
- Cápsula de ícone de estatística: `56×56px`, `--radius-md`, fundo em 8–12% de opacidade da cor + ícone na cor sólida (`.purple`, `.cyan`, `.green`).
- Um ícone por título. Não empilhar ícones decorativos.

---

## 6. Componentes — Especificação

### 6.1 Botões

| Variante | Fundo | Texto | Borda |
|---|---|---|---|
| `.btn-primary` | `--gradient-institucional` | branco | — |
| `.btn-outline` | branco | `--color-primary` | `1px rgba(19,51,90,.25)` → `--color-primary` no hover |
| `.btn-danger` | `rgba(239,68,68,.1)` → `.2` no hover | `#dc2626` | `1px rgba(239,68,68,.25)` |

Base comum: `padding: 11px 20px`, `--radius-sm`, 0.88rem, peso 700, caixa alta, `letter-spacing: .5px`, `inline-flex` com gap 8px.

**Regra de hierarquia:** no máximo **um** `.btn-primary` visível por card ou por rodapé de passo.

### 6.2 Campos de formulário

```css
padding: 12px 16px;
background: var(--color-white);
border: 1px solid rgba(19, 51, 90, 0.2);
border-radius: var(--radius-sm);
color: var(--color-primary);
font-size: 0.95rem;
font-weight: 500;
```

**Foco (obrigatório, nunca remover):** `border-color: var(--color-gradient-blue-mid)` + `box-shadow: 0 0 0 3px rgba(42,104,143,.2)`, com `outline: none`.

Estrutura: `.form-group` = `label` (0.9rem/700) → campo → `small` opcional (0.78rem, `--color-text-muted`) para explicar variáveis e limites.

### 6.3 Switch

`44×24px`, trilha `#cbd5e1` desligada e `--color-primary` ligada; botão branco de `18px` com deslocamento de `20px`; transição `.3s`.
Quando desligado, os campos dependentes recebem `.action-fields-disabled` (`opacity: .45; pointer-events: none`) — **esmaecer, nunca ocultar**, para que o usuário veja o que está desativado.

### 6.4 Badge

Pílula de `4px 12px`, `border-radius: 20px`, 0.75rem, peso 700, caixa alta.
Neutro `#e2e8f0`/`--color-primary`; variantes `badge-success`, `badge-warning`, `badge-purple`, `badge-cyan` conforme §2.3.

### 6.5 Card de conteúdo

Branco, borda `--color-border-light`, `--radius-lg`, `--shadow-main`, `overflow: hidden`, margem inferior `32px`.
`.card-header` com fundo `#fafbfc` e divisor inferior; `.card-body` com padding `28px`.

### 6.6 Stepper do wizard

Barra branca `--radius-lg`, padding `20px 32px`. Badge circular de `42px`:

| Estado | Badge | Título |
|---|---|---|
| Pendente | `#e2e8f0` / texto muted | `--color-text-muted` |
| Ativo | `--gradient-cyan` + glow ciano / texto branco | `--color-primary` |
| Concluído | `--color-success` / texto branco | `--color-primary` |

Conector: barra de `3px`, `#e2e8f0` → `--color-accent-cyan` quando percorrido.
Rodapé de passo `.wizard-actions`: `space-between`, com divisor superior — voltar à esquerda (`.btn-outline`), avançar à direita (`.btn-primary`).

### 6.7 Tabela

`width: 100%`, `border-collapse: collapse`, alinhamento à esquerda, células `14px 18px` com divisor inferior.
`th`: fonte de display, 0.75rem, peso 800, caixa alta, `letter-spacing: .8px`, fundo `#f1f5f9`.
Hover de linha: `rgba(19,51,90,.02)`. Sempre dentro de `.table-responsive` (`overflow-x: auto`).

### 6.8 Toast

`position: fixed`, 24px do canto inferior direito, `z-index: 2000`, fundo `--color-primary`, texto branco, `--radius-md`, padding `14px 24px`.
Entrada: `translateY(100px) → 0` com opacidade, via classe `.show`.
Borda esquerda de 4px indica o tipo: ciano em `.success`, `--color-danger` em `.error`.

### 6.9 Cartão de gatilho (seleção única)

`.trigger-option`: fundo `#f8fafc`, **borda de 2px**, `--radius-md`, padding `18px 20px`.
Selecionado (`:has(input:checked)`): borda `--color-primary` e fundo `#eff6ff`. Radio de 18px com `accent-color: var(--color-primary)`.
O rótulo inteiro é clicável — texto em `.trigger-title` (peso 800) + `.trigger-desc` (0.82rem, linha 1.5).

### 6.10 Hierarquia de aninhamento (URA)

Três níveis visuais, do externo ao interno:

1. `.ivr-box` — fundo `#f8fafc`, `--radius-md`, padding 22px
2. `.ivr-option-card` — branco, `--radius-sm`, padding 18px, sombra sutil `0 2px 8px rgba(0,0,0,.03)`
3. `.suboptions-box` — fundo `rgba(66,185,235,.08)` com **borda esquerda de 4px** em `--color-gradient-blue-mid`

A barra lateral ciano-azulada é o sinal de "nível mais profundo". Não aninhar além do terceiro nível visual.

---

## 7. Superfícies

| Superfície | Fundo | Texto | Observação |
|---|---|---|---|
| Sidebar | `#13335a` sólido | claro | Única superfície escura da aplicação |
| Conteúdo | `#f4f6f9` | `--color-primary` | Área de trabalho principal |
| Cards | `#ffffff` | `--color-primary` | Elevados com `--shadow-main` |
| Blocos internos | `#f8fafc` | `--color-primary` | Agrupam campos dentro de um card |
| Login | degradê azul 135° | — | Card branco centralizado, `max-width: 430px` |

**Scrollbar customizada:** 8px, trilha `#e2e8f0`, polegar `--color-gradient-blue-mid` (`--color-primary` no hover), raio 4px.

---

## 8. Identidade Verbal — Mensagens do Bot

A identidade não termina na tela: as mensagens que o FlexBot envia no Stoat seguem um padrão fixo.

### 8.1 Emoji de abertura por tipo de mensagem

| Emoji | Tipo | Exemplo em uso |
|---|---|---|
| ✅ | Sucesso / acesso liberado | `✅ **Acesso Liberado!** {user}, sua matrícula foi validada…` |
| ❌ | Erro de validação | `❌ {user}: **Matrícula não encontrada.** Verifique os 8 números digitados.` |
| 🚫 | Bloqueio por regra de negócio | `🚫 **Esta matrícula já foi utilizada.**` |
| ⚠️ | Sucesso parcial / atenção | `⚠️ **Matrícula válida, mas o cargo não pôde ser aplicado**…` |
| 👋 | Boas-vindas | `👋 **Olá {user}! Seja bem-vindo(a)…**` |
| 📢 | Comunicado em massa | `📢 **Comunicado Oficial…**` |
| 📩 | Confirmação enviada na DM | `📩 Olá {user}! Sua matrícula foi validada…` |
| 💡 | Orientação / próximo passo | `💡 **Por favor, escolha uma das opções do menu…**` |
| 📋 | Listagem / menu | Apresentação de opções |

**Um emoji, sempre no início da mensagem.** Nunca dois seguidos, nunca no meio da frase.

### 8.2 Estrutura da mensagem

1. Emoji + **frase-chave em negrito** (`**…**`) resumindo o resultado;
2. Detalhe ou instrução em texto normal;
3. Quebra de linha dupla antes de um bloco de orientação separado.

### 8.3 Variáveis de template

| Variável | Substituição |
|---|---|
| `{user}` | Menção ao usuário (`<@id>`) |
| `{role}` | Nome do cargo atribuído |
| `{server}` | Nome do servidor |

### 8.4 Tom de voz

Institucional e direto, em português do Brasil, tratando o usuário por **você**. Sempre indicar o próximo passo
em caso de falha ("Verifique se os 8 números foram digitados corretamente", "Procure o suporte…").
Evitar jargão técnico e nunca expor mensagens de erro cruas da API ao usuário final.

---

## 9. Regras de Uso

### Faça

- Use os tokens `var(--…)`; se precisar de um valor novo, adicione-o ao `:root` em vez de escrever o hex no componente.
- Encerre títulos de página e de card com o `.triangulo-ponto`.
- Mantenha um único `.btn-primary` por bloco de ação.
- Preserve o anel de foco de 3px em todos os campos — é o principal recurso de acessibilidade da interface.
- Reaproveite `.content-card`, `.form-row`, `.form-group` e `.data-table` antes de criar estrutura nova.
- Agrupe campos opcionais em `.action-block` com um `.switch` que os esmaece quando desligados.

### Não faça

- Não introduza cinzas, azuis ou raios fora das tabelas acima.
- Não use ciano `#42b9eb` como cor de texto sobre fundo claro.
- Não aplique caixa alta em títulos ou texto corrido.
- Não misture estilos do Font Awesome nem outra biblioteca de ícones.
- Não use sombra preta neutra em elementos do conteúdo — a elevação é azulada.
- Não oculte campos desativados: esmaeça-os.
- Não altere o ângulo dos degradês (135°) nem a ordem das paradas de cor.

---

## 10. Tokens para Reaproveitamento

Bloco pronto para copiar ao criar uma tela ou ferramenta nova dentro do padrão FlexBot:

```css
:root {
  /* Institucionais */
  --color-primary: #13335a;
  --color-primary-dark: #0d223d;
  --color-neutral-light: #eceded;
  --color-neutral-bg: #f4f6f9;
  --color-white: #ffffff;
  --color-text-dark: #13335a;
  --color-text-muted: #475569;
  --color-border-light: rgba(19, 51, 90, 0.12);

  /* Acento e degradês */
  --color-gradient-blue-mid: #2a688f;
  --color-accent-cyan: #42b9eb;
  --gradient-institucional: linear-gradient(135deg, #13335a 0%, #2a688f 100%);
  --gradient-cyan: linear-gradient(135deg, #2a688f 0%, #42b9eb 100%);

  /* Status */
  --color-success: #10b981;
  --color-warning: #d97706;
  --color-danger: #ef4444;

  /* Tipografia */
  --font-family: 'Cera Pro', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  --font-heading: 'Cera Pro Black', 'Outfit', sans-serif;
  --tracking-display: -0.03em;

  /* Bordas e sombras */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --shadow-main: 0 4px 20px rgba(19, 51, 90, 0.08);
  --shadow-hover: 0 8px 28px rgba(19, 51, 90, 0.14);
}
```

---

## 11. Desvios Conhecidos do Padrão

Divergências reais entre o padrão acima e o código atual, registradas para correção futura:

| Onde | Desvio | Correção sugerida |
|---|---|---|
| `login.html` | Não carrega o Google Fonts — a tela cai na fonte de sistema, enquanto o dashboard usa Inter/Outfit | Incluir o mesmo `<link>` de fontes do `index.html` |
| `login.html` | Azuis próprios `#1e4a7a` e `#2d7dd2` fora da paleta tokenizada | Migrar para `--color-primary` e `--color-gradient-blue-mid` |
| `login.html` | Raios `18px`, `16px` e `10px` fora da escala 6/10/14 | Usar `--radius-lg` e `--radius-md` |
| `login.html` | Font Awesome **6.5.1** contra **6.4.0** no dashboard | Unificar a versão |
| `style.css` | Sem `@font-face` para Cera Pro — a fonte institucional só aparece em máquinas que a tenham instalada | Hospedar a fonte localmente ou assumir Inter/Outfit como oficiais da web |
| `style.css` | Nenhum `@media` — layout fixo para desktop | Definir breakpoints se o uso em tablet/celular entrar em escopo |
