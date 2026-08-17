#!/usr/bin/env bash
# =============================================================================
# FlexBot — Instalador para VM Linux (Ubuntu 22.04+) com Tailscale
# =============================================================================
#
# O que este script faz, em ordem:
#   1. Valida o sistema operacional (Ubuntu 22.04+)
#   2. Instala dependências base (curl, git, ca-certificates)
#   3. Instala o Docker Engine + Compose plugin (se ausentes) e habilita o serviço
#   4. Obtém o código do FlexBot (usa a pasta atual se já for o projeto, ou clona)
#   5. Valida o .env (STOAT_TOKEN obrigatório)
#   6. Sobe o container via docker compose (build + start)
#   7. Testa a saúde do Dashboard (http://127.0.0.1:3000/api/status)
#   8. Publica o Dashboard na rede Tailscale via `tailscale serve` (HTTPS)
#
# Uso:
#   bash scripts/setup-vm.sh              # de dentro da pasta do projeto
#   REPO_URL=https://github.com/lhuannc/flex-bot.git bash setup-vm.sh   # clonando
#
# Segurança: o Dashboard NÃO possui autenticação. Por isso o docker-compose.yml
# faz bind apenas em 127.0.0.1 e o acesso remoto é exclusivamente pela rede
# privada do Tailscale (https://<sua-maquina>.ts.net). Nunca exponha a porta
# 3000 em interface pública.
# =============================================================================

set -euo pipefail

# ----------------------------------------------------------------------------
# Utilitários de log
# ----------------------------------------------------------------------------
C_GREEN='\033[0;32m'; C_YELLOW='\033[1;33m'; C_RED='\033[0;31m'; C_BLUE='\033[0;34m'; C_OFF='\033[0m'
ok()   { echo -e "${C_GREEN}[ OK ]${C_OFF} $*"; }
info() { echo -e "${C_BLUE}[INFO]${C_OFF} $*"; }
warn() { echo -e "${C_YELLOW}[AVISO]${C_OFF} $*"; }
fail() { echo -e "${C_RED}[ERRO]${C_OFF} $*" >&2; exit 1; }

REPO_URL="${REPO_URL:-https://github.com/lhuannc/flex-bot.git}"
INSTALL_DIR="${INSTALL_DIR:-$HOME/flex-bot}"

# sudo apenas quando não somos root
if [ "$(id -u)" -eq 0 ]; then SUDO=""; else
  command -v sudo >/dev/null 2>&1 || fail "Execute como root ou instale o sudo."
  SUDO="sudo"
fi

echo "============================================================"
echo " FlexBot — Instalação na VM (Ubuntu + Docker + Tailscale)"
echo "============================================================"

# ----------------------------------------------------------------------------
# 1. Sistema operacional
# ----------------------------------------------------------------------------
if [ -r /etc/os-release ]; then
  . /etc/os-release
  if [ "${ID:-}" = "ubuntu" ]; then
    MAJOR="${VERSION_ID%%.*}"
    if [ "$MAJOR" -ge 22 ] 2>/dev/null; then
      ok "Ubuntu $VERSION_ID detectado."
    else
      warn "Ubuntu $VERSION_ID é anterior ao 22.04 — o script segue, mas não foi testado nessa versão."
    fi
  else
    warn "Distribuição '${ID:-desconhecida}' não é Ubuntu — a instalação do Docker pode divergir."
  fi
else
  warn "Não foi possível identificar o sistema operacional."
fi

# ----------------------------------------------------------------------------
# 2. Dependências base
# ----------------------------------------------------------------------------
info "Atualizando índice de pacotes e instalando dependências base..."
$SUDO apt-get update -qq
$SUDO apt-get install -y -qq ca-certificates curl git >/dev/null
ok "Dependências base instaladas (ca-certificates, curl, git)."

# ----------------------------------------------------------------------------
# 3. Docker Engine + Compose plugin
# ----------------------------------------------------------------------------
if command -v docker >/dev/null 2>&1; then
  ok "Docker já instalado: $(docker --version)"
else
  info "Docker não encontrado — instalando via script oficial (get.docker.com)..."
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  $SUDO sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
  ok "Docker instalado: $(docker --version)"
fi

if $SUDO docker compose version >/dev/null 2>&1; then
  ok "Docker Compose disponível: $($SUDO docker compose version --short 2>/dev/null || echo plugin)"
else
  info "Compose plugin ausente — instalando docker-compose-plugin..."
  $SUDO apt-get install -y -qq docker-compose-plugin >/dev/null \
    || fail "Não foi possível instalar o docker-compose-plugin. Instale manualmente e rode de novo."
  ok "Docker Compose instalado."
fi

info "Habilitando e iniciando o serviço do Docker..."
$SUDO systemctl enable --now docker >/dev/null 2>&1 || true
$SUDO docker info >/dev/null 2>&1 || fail "O daemon do Docker não está respondendo. Verifique: systemctl status docker"
ok "Daemon do Docker ativo."

# Grupo docker (efetivo apenas no próximo login; o script usa sudo até lá)
if [ -n "$SUDO" ] && ! id -nG "$USER" | grep -qw docker; then
  $SUDO usermod -aG docker "$USER"
  warn "Usuário '$USER' adicionado ao grupo docker — faça logout/login para usar docker sem sudo."
fi

# ----------------------------------------------------------------------------
# 4. Código do FlexBot
# ----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$SCRIPT_DIR/../docker-compose.yml" ]; then
  PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
  ok "Projeto encontrado na pasta atual: $PROJECT_DIR"
elif [ -f "./docker-compose.yml" ]; then
  PROJECT_DIR="$(pwd)"
  ok "Projeto encontrado na pasta atual: $PROJECT_DIR"
elif [ -d "$INSTALL_DIR/.git" ]; then
  PROJECT_DIR="$INSTALL_DIR"
  info "Projeto já clonado em $PROJECT_DIR — atualizando (git pull)..."
  git -C "$PROJECT_DIR" pull --ff-only || warn "git pull falhou — seguindo com a versão local."
else
  info "Clonando $REPO_URL em $INSTALL_DIR..."
  git clone "$REPO_URL" "$INSTALL_DIR"
  PROJECT_DIR="$INSTALL_DIR"
  ok "Repositório clonado."
fi
cd "$PROJECT_DIR"

# ----------------------------------------------------------------------------
# 5. Arquivo .env
# ----------------------------------------------------------------------------
if [ ! -f .env ]; then
  cp .env.example .env
  warn "Arquivo .env criado a partir do .env.example."
  echo ""
  echo "  >>> Edite o arquivo e preencha o token do bot:"
  echo "      nano $PROJECT_DIR/.env"
  echo "      (obrigatório: STOAT_TOKEN)"
  echo ""
  fail "Preencha o .env e execute o script novamente."
fi

# Lê uma variável do .env de forma robusta: tolera aspas simples/duplas,
# espaços ao redor do "=", linhas comentadas e terminadores CRLF (arquivo
# editado no Windows). Um `cut` simples devolveria as aspas junto do valor.
read_env() {
  local chave="$1" linha valor
  linha="$(grep -E "^[[:space:]]*${chave}[[:space:]]*=" .env 2>/dev/null | tail -1)"
  [ -z "$linha" ] && return 0

  valor="${linha#*=}"
  valor="$(printf '%s' "$valor" | tr -d '\r')"
  valor="$(printf '%s' "$valor" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//')"
  valor="$(printf '%s' "$valor" | sed -E "s/^\"(.*)\"$/\1/; s/^'(.*)'$/\1/")"
  printf '%s' "$valor"
}

TOKEN_VALUE="$(read_env STOAT_TOKEN)"
if [ -z "$TOKEN_VALUE" ] || [ "$TOKEN_VALUE" = "seu_token_aqui" ]; then
  fail "STOAT_TOKEN não configurado no .env ($PROJECT_DIR/.env). Preencha e rode de novo."
fi
ok ".env validado (STOAT_TOKEN presente)."

# Estado da autenticação — decide se a exposição pública pode ser liberada
AUTH_CLIENT_ID="$(read_env GOOGLE_CLIENT_ID)"
AUTH_CLIENT_SECRET="$(read_env GOOGLE_CLIENT_SECRET)"
AUTH_EMAILS="$(read_env ALLOWED_EMAILS)"
AUTH_SECRET="$(read_env SESSION_SECRET)"

if [ -n "$AUTH_CLIENT_ID" ] && [ -n "$AUTH_CLIENT_SECRET" ] && [ -n "$AUTH_EMAILS" ]; then
  AUTH_ENABLED=1
  ok "Login com Google configurado (autorizados: $AUTH_EMAILS)."
  if [ -z "$AUTH_SECRET" ]; then
    warn "SESSION_SECRET vazio — as sessões cairão a cada restart. Gere um: openssl rand -hex 32"
  fi
else
  AUTH_ENABLED=0
  warn "Login com Google NÃO configurado — o Dashboard ficará aberto a quem alcançar a porta."
fi

mkdir -p data
ok "Diretório de dados pronto (./data — persiste fora do container)."

# ----------------------------------------------------------------------------
# 6. Subir o container
# ----------------------------------------------------------------------------
info "Construindo a imagem e subindo o container (docker compose up -d --build)..."
$SUDO docker compose up -d --build
ok "Container iniciado."

# ----------------------------------------------------------------------------
# 7. Health check do Dashboard
# ----------------------------------------------------------------------------
info "Aguardando o Dashboard responder em http://127.0.0.1:3000 ..."

# Com o login ativo, /api/status responde 401 sem sessão — por isso o health
# check considera QUALQUER resposta HTTP como "servidor no ar" (401 e 302
# inclusive). Usar `curl -f` aqui daria falso negativo com autenticação ligada.
HEALTH_OK=0
for i in $(seq 1 30); do
  CODIGO="$(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/login.html 2>/dev/null || echo 000)"
  if [ "$CODIGO" != "000" ]; then HEALTH_OK=1; break; fi
  sleep 2
done

if [ "$HEALTH_OK" -eq 1 ]; then
  ok "Dashboard no ar (HTTP $CODIGO)."

  # O status do bot só é legível sem autenticação quando o login está desligado
  if [ "$AUTH_ENABLED" -eq 0 ]; then
    STATUS_JSON="$(curl -s http://127.0.0.1:3000/api/status 2>/dev/null || echo '')"
    case "$STATUS_JSON" in
      *'"online":true'*) ok "Bot conectado ao Stoat." ;;
      *) warn "Bot ainda não conectou ao Stoat — confira o token: $SUDO docker logs -f flex-bot-app" ;;
    esac
  else
    # Com login ativo, confirmamos a conexão pelo log do container
    if $SUDO docker logs --tail 40 flex-bot-app 2>&1 | grep -q "Bot conectado com sucesso"; then
      ok "Bot conectado ao Stoat."
    else
      warn "Bot ainda não conectou ao Stoat — confira o token: $SUDO docker logs -f flex-bot-app"
    fi
  fi
else
  $SUDO docker logs --tail 30 flex-bot-app || true
  fail "Dashboard não respondeu em 60s. Logs acima — verifique: $SUDO docker logs -f flex-bot-app"
fi

# ----------------------------------------------------------------------------
# 8. Decisão: acesso PRIVADO (tailnet) ou PÚBLICO (internet)
# ----------------------------------------------------------------------------
#
#   Serve  = HTTPS apenas para dispositivos do SEU tailnet  (privado)
#   Funnel = HTTPS aberto para a internet inteira           (público)
#
# A exposição pública só é liberada quando o login com Google está configurado.
# Sem autenticação, publicar na internet entregaria o painel — e a base de
# matrículas — a qualquer pessoa que descobrisse a URL.
#
# Modo não-interativo: defina EXPOSE_PUBLIC=yes (ou no) antes de rodar.
# Sem TTY e sem a variável, o padrão é o modo PRIVADO.
# ----------------------------------------------------------------------------
EXPOR_PUBLICO=0
ESCOLHA="${EXPOSE_PUBLIC:-}"

if [ -z "$ESCOLHA" ]; then
  if [ -t 0 ]; then
    echo ""
    echo "------------------------------------------------------------"
    echo " Como o Dashboard deve ser acessado?"
    echo ""
    echo "   [1] PRIVADO  (padrão) — somente dispositivos conectados ao"
    echo "                 seu Tailscale conseguem abrir o endereço."
    echo ""
    echo "   [2] PÚBLICO  — qualquer pessoa na internet alcança a URL."
    echo "                 O login com Google continua exigido: só os"
    echo "                 e-mails da allowlist entram no painel."
    echo "------------------------------------------------------------"
    printf "Escolha [1/2] (ENTER = 1, privado): "
    read -r RESPOSTA </dev/tty || RESPOSTA=""
    case "$RESPOSTA" in
      2|p|P|pub*|s|S|y|Y) ESCOLHA="yes" ;;
      *) ESCOLHA="no" ;;
    esac
  else
    ESCOLHA="no"
    info "Execução não-interativa: mantendo o acesso PRIVADO (use EXPOSE_PUBLIC=yes para expor)."
  fi
fi

case "$ESCOLHA" in
  yes|YES|y|Y|true|1|sim|SIM) EXPOR_PUBLICO=1 ;;
  *) EXPOR_PUBLICO=0 ;;
esac

# Trava de segurança: sem login configurado, não há exposição pública
if [ "$EXPOR_PUBLICO" -eq 1 ] && [ "$AUTH_ENABLED" -eq 0 ]; then
  warn "EXPOSIÇÃO PÚBLICA RECUSADA: o login com Google não está configurado."
  echo "       Sem autenticação, publicar na internet libera o painel e a base"
  echo "       de matrículas para qualquer um. Preencha no .env:"
  echo "         GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e ALLOWED_EMAILS"
  echo "       Seguindo em modo PRIVADO (apenas o seu tailnet)."
  EXPOR_PUBLICO=0
fi

# ----------------------------------------------------------------------------
# 9. Publicação na rede Tailscale (HTTPS)
# ----------------------------------------------------------------------------
TS_URL=""
if command -v tailscale >/dev/null 2>&1; then
  if $SUDO tailscale status >/dev/null 2>&1; then
    TS_HOST="$($SUDO tailscale status --json 2>/dev/null | grep -o '"DNSName": *"[^"]*"' | head -1 | sed 's/.*"DNSName": *"\([^"]*\)".*/\1/' | sed 's/\.$//')"
    info "Tailscale ativo (máquina: ${TS_HOST:-desconhecida})."

    if $SUDO tailscale serve --bg 3000 >/dev/null 2>&1; then
      TS_URL="https://${TS_HOST:-<sua-maquina>.ts.net}"
      ok "Dashboard publicado na sua rede Tailscale: $TS_URL"
    elif $SUDO tailscale serve --bg --https=443 http://127.0.0.1:3000 >/dev/null 2>&1; then
      TS_URL="https://${TS_HOST:-<sua-maquina>.ts.net}"
      ok "Dashboard publicado na sua rede Tailscale: $TS_URL"
    else
      warn "Não foi possível ativar o Tailscale Serve automaticamente (versão antiga ou HTTPS desabilitado no tailnet)."
      echo "       Tente manualmente:  sudo tailscale serve --bg 3000"
      echo "       (Requer MagicDNS + HTTPS habilitados no painel do Tailscale.)"
    fi
  else
    warn "Tailscale instalado, mas não conectado. Rode: sudo tailscale up   — e depois: sudo tailscale serve --bg 3000"
  fi
else
  warn "Tailscale não encontrado nesta VM. Instale (https://tailscale.com/download) e rode: sudo tailscale serve --bg 3000"
fi

# ----------------------------------------------------------------------------
# Resumo final
# ----------------------------------------------------------------------------
echo ""
echo "============================================================"
echo -e " ${C_GREEN}Instalação concluída!${C_OFF}"
echo "============================================================"
echo ""
echo "  Dashboard (nesta VM):    http://127.0.0.1:3000"
[ -n "$TS_URL" ] && echo "  Dashboard (rede Tailscale): $TS_URL"
echo ""
echo "  Comandos úteis:"
echo "    Logs ao vivo:      $SUDO docker logs -f flex-bot-app"
echo "    Reiniciar:         $SUDO docker compose -f $PROJECT_DIR/docker-compose.yml restart"
echo "    Atualizar versão:  cd $PROJECT_DIR && git pull && $SUDO docker compose up -d --build"
echo "    Backup dos dados:  cp -r $PROJECT_DIR/data /caminho/do/backup"
echo ""
echo "  ⚠️ O Dashboard não tem autenticação: o acesso externo deve ser"
echo "     SEMPRE pela rede Tailscale — a porta 3000 escuta só em 127.0.0.1."
echo ""
