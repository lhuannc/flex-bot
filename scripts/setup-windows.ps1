<#
.SYNOPSIS
    FlexBot — Instalador para Windows (Docker Desktop + Tailscale)

.DESCRIPTION
    Equivalente ao scripts/setup-vm.sh (Linux). Valida e prepara todo o ambiente:

      1. Verifica se está rodando como Administrador
      2. Valida a versão do Windows (10/11 ou Server 2019+)
      3. Verifica/instala o Docker Desktop (via winget) e confere se o daemon responde
      4. Verifica/instala o Tailscale (via winget) e confere a conexão
      5. Localiza o projeto (pasta atual) ou clona do GitHub
      6. Valida o .env (STOAT_TOKEN obrigatório) e detecta o login com Google
      7. Sobe o container (docker compose up -d --build)
      8. Testa a saúde do Dashboard
      9. Pergunta se o acesso será PRIVADO (tailnet) ou PÚBLICO (internet)
     10. Publica via Tailscale Serve ou Funnel

    A exposição pública só é liberada quando o login com Google está configurado.

.PARAMETER ExposePublic
    Define o modo sem perguntar: 'yes' expõe na internet, 'no' mantém privado.
    Equivale à variável de ambiente EXPOSE_PUBLIC do script Linux.

.PARAMETER InstallDir
    Pasta de instalação quando o projeto precisar ser clonado.

.EXAMPLE
    .\scripts\setup-windows.ps1
    Executa em modo interativo, perguntando sobre a exposição.

.EXAMPLE
    .\scripts\setup-windows.ps1 -ExposePublic yes
    Executa sem perguntas e expõe o Dashboard na internet.
#>

[CmdletBinding()]
param(
    [ValidateSet('yes', 'no')]
    [string]$ExposePublic = '',

    [string]$InstallDir = "$env:USERPROFILE\flex-bot",

    [string]$RepoUrl = 'https://github.com/lhuannc/flex-bot.git'
)

$ErrorActionPreference = 'Stop'

# ----------------------------------------------------------------------------
# Utilitários de log
# ----------------------------------------------------------------------------
function Write-Ok    { param([string]$Msg) Write-Host "[ OK ] " -ForegroundColor Green  -NoNewline; Write-Host $Msg }
function Write-Info  { param([string]$Msg) Write-Host "[INFO] " -ForegroundColor Cyan   -NoNewline; Write-Host $Msg }
function Write-Warn  { param([string]$Msg) Write-Host "[AVISO] " -ForegroundColor Yellow -NoNewline; Write-Host $Msg }
function Write-Fail  {
    param([string]$Msg)
    Write-Host "[ERRO] " -ForegroundColor Red -NoNewline
    Write-Host $Msg
    exit 1
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host " FlexBot - Instalacao no Windows (Docker + Tailscale)"       -ForegroundColor DarkCyan
Write-Host "============================================================" -ForegroundColor DarkCyan
Write-Host ""

# ----------------------------------------------------------------------------
# 1. Privilégios de Administrador
# ----------------------------------------------------------------------------
$identidade = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal  = New-Object Security.Principal.WindowsPrincipal($identidade)
$isAdmin    = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isAdmin) {
    Write-Ok "Executando como Administrador."
} else {
    Write-Warn "Sem privilegios de Administrador."
    Write-Host "        A instalacao de programas e o Tailscale Funnel exigem elevacao."
    Write-Host "        Reabra o PowerShell com 'Executar como administrador' se algo falhar."
}

# ----------------------------------------------------------------------------
# 2. Versão do Windows
# ----------------------------------------------------------------------------
$os = Get-CimInstance Win32_OperatingSystem
$versao = [Version]$os.Version
if ($versao.Major -ge 10) {
    Write-Ok "$($os.Caption) (build $($os.BuildNumber)) detectado."
} else {
    Write-Warn "$($os.Caption) e anterior ao Windows 10 - o Docker Desktop pode nao ser suportado."
}

# ----------------------------------------------------------------------------
# 3. Docker Desktop
# ----------------------------------------------------------------------------
$temWinget = $null -ne (Get-Command winget -ErrorAction SilentlyContinue)

if (Get-Command docker -ErrorAction SilentlyContinue) {
    Write-Ok "Docker encontrado: $((docker --version) -join '')"
} else {
    Write-Info "Docker nao encontrado."
    if ($temWinget) {
        Write-Info "Instalando o Docker Desktop via winget (pode demorar alguns minutos)..."
        winget install -e --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
        Write-Warn "Docker Desktop instalado. INICIE o Docker Desktop e aguarde ficar 'Running',"
        Write-Fail "depois execute este script novamente."
    } else {
        Write-Fail "Instale o Docker Desktop manualmente: https://www.docker.com/products/docker-desktop/"
    }
}

# O daemon precisa estar de pé, não basta o executável existir
Write-Info "Verificando o daemon do Docker..."
docker info 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "O Docker Desktop nao esta em execucao. Abra-o, aguarde o status 'Running' e rode o script de novo."
}
Write-Ok "Daemon do Docker respondendo."

docker compose version 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Fail "O plugin 'docker compose' nao esta disponivel. Atualize o Docker Desktop."
}
Write-Ok "Docker Compose disponivel."

# ----------------------------------------------------------------------------
# 4. Tailscale
# ----------------------------------------------------------------------------
$tailscaleExe = "$env:ProgramFiles\Tailscale\tailscale.exe"
if (-not (Test-Path $tailscaleExe)) {
    $cmdTs = Get-Command tailscale -ErrorAction SilentlyContinue
    if ($cmdTs) { $tailscaleExe = $cmdTs.Source } else { $tailscaleExe = $null }
}

if ($tailscaleExe) {
    Write-Ok "Tailscale encontrado."
} else {
    Write-Info "Tailscale nao encontrado."
    if ($temWinget) {
        Write-Info "Instalando o Tailscale via winget..."
        winget install -e --id tailscale.tailscale --accept-package-agreements --accept-source-agreements
        $tailscaleExe = "$env:ProgramFiles\Tailscale\tailscale.exe"
        if (Test-Path $tailscaleExe) {
            Write-Ok "Tailscale instalado."
            Write-Warn "Conecte-se a sua rede: & '$tailscaleExe' up"
        } else {
            Write-Warn "Instalacao concluida, mas o executavel nao foi localizado. Reabra o PowerShell."
            $tailscaleExe = $null
        }
    } else {
        Write-Warn "Instale o Tailscale manualmente: https://tailscale.com/download/windows"
    }
}

# ----------------------------------------------------------------------------
# 5. Código do FlexBot
# ----------------------------------------------------------------------------
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectDir = $null

if (Test-Path (Join-Path $scriptDir '..\docker-compose.yml')) {
    $projectDir = (Resolve-Path (Join-Path $scriptDir '..')).Path
    Write-Ok "Projeto encontrado em: $projectDir"
} elseif (Test-Path '.\docker-compose.yml') {
    $projectDir = (Get-Location).Path
    Write-Ok "Projeto encontrado na pasta atual: $projectDir"
} elseif (Test-Path (Join-Path $InstallDir '.git')) {
    $projectDir = $InstallDir
    Write-Info "Projeto ja clonado em $projectDir - atualizando (git pull)..."
    Push-Location $projectDir
    git pull --ff-only
    if ($LASTEXITCODE -ne 0) { Write-Warn "git pull falhou - seguindo com a versao local." }
    Pop-Location
} else {
    if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
        Write-Fail "git nao encontrado. Instale: winget install -e --id Git.Git"
    }
    Write-Info "Clonando $RepoUrl em $InstallDir..."
    git clone $RepoUrl $InstallDir
    if ($LASTEXITCODE -ne 0) { Write-Fail "Falha ao clonar o repositorio." }
    $projectDir = $InstallDir
    Write-Ok "Repositorio clonado."
}

Set-Location $projectDir

# ----------------------------------------------------------------------------
# 6. Arquivo .env
# ----------------------------------------------------------------------------

# Lê uma variável do .env tolerando aspas, espaços ao redor do "=" e comentários
function Read-EnvValue {
    param([string]$Chave)

    if (-not (Test-Path '.env')) { return '' }

    $padrao = "^\s*$([regex]::Escape($Chave))\s*="
    $linha = Get-Content '.env' -ErrorAction SilentlyContinue |
             Where-Object { $_ -match $padrao } |
             Select-Object -Last 1

    if (-not $linha) { return '' }

    $valor = ($linha -split '=', 2)[1]
    if ($null -eq $valor) { return '' }
    $valor = $valor.Trim()

    if ($valor.Length -ge 2) {
        $primeiro = $valor.Substring(0, 1)
        $ultimo   = $valor.Substring($valor.Length - 1, 1)
        if (($primeiro -eq '"' -and $ultimo -eq '"') -or ($primeiro -eq "'" -and $ultimo -eq "'")) {
            $valor = $valor.Substring(1, $valor.Length - 2)
        }
    }
    return $valor
}

if (-not (Test-Path '.env')) {
    Copy-Item '.env.example' '.env'
    Write-Warn "Arquivo .env criado a partir do .env.example."
    Write-Host ""
    Write-Host "  >>> Edite o arquivo e preencha o token do bot:"
    Write-Host "      notepad $projectDir\.env"
    Write-Host "      (obrigatorio: STOAT_TOKEN)"
    Write-Host ""
    Write-Fail "Preencha o .env e execute o script novamente."
}

$tokenValue = Read-EnvValue 'STOAT_TOKEN'
if ([string]::IsNullOrWhiteSpace($tokenValue) -or $tokenValue -eq 'seu_token_aqui') {
    Write-Fail "STOAT_TOKEN nao configurado em $projectDir\.env. Preencha e rode de novo."
}
Write-Ok ".env validado (STOAT_TOKEN presente)."

# Estado da autenticação — decide se a exposição pública pode ser liberada
$authClientId     = Read-EnvValue 'GOOGLE_CLIENT_ID'
$authClientSecret = Read-EnvValue 'GOOGLE_CLIENT_SECRET'
$authEmails       = Read-EnvValue 'ALLOWED_EMAILS'
$authSecret       = Read-EnvValue 'SESSION_SECRET'
$publicUrl        = Read-EnvValue 'PUBLIC_URL'

$authEnabled = (-not [string]::IsNullOrWhiteSpace($authClientId)) -and
               (-not [string]::IsNullOrWhiteSpace($authClientSecret)) -and
               (-not [string]::IsNullOrWhiteSpace($authEmails))

if ($authEnabled) {
    Write-Ok "Login com Google configurado (autorizados: $authEmails)."
    if ([string]::IsNullOrWhiteSpace($authSecret)) {
        Write-Warn "SESSION_SECRET vazio - as sessoes cairao a cada restart."
    } elseif ($authSecret.Length -lt 24) {
        Write-Warn "SESSION_SECRET curto ($($authSecret.Length) caracteres) - use um valor longo e aleatorio."
        Write-Host "        Gere um assim:  -join ((1..32) | ForEach-Object { '{0:x2}' -f (Get-Random -Max 256) })"
    }
} else {
    Write-Warn "Login com Google NAO configurado - o Dashboard ficara aberto a quem alcancar a porta."
}

if (-not (Test-Path 'data')) { New-Item -ItemType Directory 'data' | Out-Null }
Write-Ok "Diretorio de dados pronto (.\data - persiste fora do container)."

# ----------------------------------------------------------------------------
# 7. Subir o container
# ----------------------------------------------------------------------------
Write-Info "Construindo a imagem e subindo o container..."
docker compose up -d --build --force-recreate
if ($LASTEXITCODE -ne 0) { Write-Fail "Falha ao subir o container. Verifique a saida acima." }
Write-Ok "Container iniciado."

# ----------------------------------------------------------------------------
# 8. Health check do Dashboard
# ----------------------------------------------------------------------------
Write-Info "Aguardando o Dashboard responder em http://127.0.0.1:3000 ..."

# Com o login ativo, /api/status responde 401 sem sessao - por isso qualquer
# resposta HTTP conta como "servidor no ar", inclusive 401 e 302.
$healthOk = $false
for ($i = 1; $i -le 30; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri 'http://127.0.0.1:3000/login.html' -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
        $healthOk = $true
        break
    } catch {
        if ($_.Exception.Response) { $healthOk = $true; break }
        Start-Sleep -Seconds 2
    }
}

if ($healthOk) {
    Write-Ok "Dashboard no ar."
    $logs = docker logs --tail 40 flex-bot-app 2>&1 | Out-String
    if ($logs -match 'Bot conectado com sucesso') {
        Write-Ok "Bot conectado ao Stoat."
    } else {
        Write-Warn "Bot ainda nao conectou ao Stoat - confira o token: docker logs -f flex-bot-app"
    }
} else {
    docker logs --tail 30 flex-bot-app
    Write-Fail "Dashboard nao respondeu em 60s. Logs acima."
}

# ----------------------------------------------------------------------------
# 9. Decisão: acesso PRIVADO (tailnet) ou PÚBLICO (internet)
# ----------------------------------------------------------------------------
#
#   Serve  = HTTPS apenas para dispositivos do SEU tailnet  (privado)
#   Funnel = HTTPS aberto para a internet inteira           (publico)
#
$exporPublico = $false
$escolha = $ExposePublic
if ([string]::IsNullOrWhiteSpace($escolha)) { $escolha = $env:EXPOSE_PUBLIC }

if ([string]::IsNullOrWhiteSpace($escolha)) {
    if ([Environment]::UserInteractive -and -not [Console]::IsInputRedirected) {
        Write-Host ""
        Write-Host "------------------------------------------------------------"
        Write-Host " Como o Dashboard deve ser acessado?"
        Write-Host ""
        Write-Host "   [1] PRIVADO  (padrao) - somente dispositivos conectados ao"
        Write-Host "                 seu Tailscale conseguem abrir o endereco."
        Write-Host ""
        Write-Host "   [2] PUBLICO  - qualquer pessoa na internet alcanca a URL."
        Write-Host "                 O login com Google continua exigido: so os"
        Write-Host "                 e-mails da allowlist entram no painel."
        Write-Host "------------------------------------------------------------"
        $resposta = Read-Host "Escolha [1/2] (ENTER = 1, privado)"
        if ($resposta -match '^(2|p|pub|s|sim|y|yes)$') { $escolha = 'yes' } else { $escolha = 'no' }
    } else {
        $escolha = 'no'
        Write-Info "Execucao nao-interativa: mantendo o acesso PRIVADO (use -ExposePublic yes para expor)."
    }
}

if ($escolha -match '^(yes|y|true|1|sim)$') { $exporPublico = $true }

# Trava de seguranca: sem login configurado, nao ha exposicao publica
if ($exporPublico -and -not $authEnabled) {
    Write-Warn "EXPOSICAO PUBLICA RECUSADA: o login com Google nao esta configurado."
    Write-Host "        Sem autenticacao, publicar na internet libera o painel e a base"
    Write-Host "        de matriculas para qualquer um. Preencha no .env:"
    Write-Host "          GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e ALLOWED_EMAILS"
    Write-Host "        Seguindo em modo PRIVADO (apenas o seu tailnet)."
    $exporPublico = $false
}

# ----------------------------------------------------------------------------
# 10. Publicação na rede Tailscale
# ----------------------------------------------------------------------------
$tsUrl = ''
$modoAcesso = 'nao publicado'

if ($tailscaleExe -and (Test-Path $tailscaleExe)) {
    $tsStatusJson = & $tailscaleExe status --json 2>$null | Out-String
    if ($LASTEXITCODE -eq 0 -and $tsStatusJson) {
        $tsHost = ''
        try {
            $tsHost = (($tsStatusJson | ConvertFrom-Json).Self.DNSName).TrimEnd('.')
        } catch { }

        Write-Info "Tailscale ativo (maquina: $tsHost)."

        if ($exporPublico) {
            Write-Info "Publicando o Dashboard na INTERNET via Tailscale Funnel..."
            # Sintaxe atual (Tailscale 1.52+). A porta publica e sempre 443;
            # o 3000 e o alvo local.
            & $tailscaleExe funnel --bg 3000 2>&1 | Out-Null

            if ($LASTEXITCODE -eq 0) {
                $tsUrl = "https://$tsHost"
                $modoAcesso = 'PUBLICO (internet)'
                Write-Ok "Dashboard PUBLICO na internet: $tsUrl"
            } else {
                Write-Warn "Nao foi possivel ativar o Funnel automaticamente."
                Write-Host "        Causa mais comum: o atributo 'funnel' nao esta liberado na policy do tailnet."
                Write-Host "        Rode manualmente (ele imprime um link para habilitar):"
                Write-Host "          & '$tailscaleExe' funnel --bg 3000"
                Write-Host ""
                Write-Host "        Ou adicione no admin console -> Access controls:"
                Write-Host '          "nodeAttrs": [{ "target": ["autogroup:member"], "attr": ["funnel"] }]'
                Write-Info "Tentando publicar em modo privado como alternativa..."

                & $tailscaleExe serve --bg 3000 2>&1 | Out-Null
                if ($LASTEXITCODE -eq 0) {
                    $tsUrl = "https://$tsHost"
                    $modoAcesso = 'PRIVADO (apenas o tailnet)'
                    Write-Ok "Dashboard publicado no seu tailnet: $tsUrl"
                }
            }
        } else {
            Write-Info "Publicando o Dashboard no seu tailnet (acesso privado)..."
            & $tailscaleExe serve --bg 3000 2>&1 | Out-Null

            if ($LASTEXITCODE -eq 0) {
                $tsUrl = "https://$tsHost"
                $modoAcesso = 'PRIVADO (apenas o tailnet)'
                Write-Ok "Dashboard publicado no seu tailnet: $tsUrl"
            } else {
                Write-Warn "Nao foi possivel ativar o Tailscale Serve automaticamente."
                Write-Host "        Tente manualmente: & '$tailscaleExe' serve --bg 3000"
                Write-Host "        (Requer MagicDNS e HTTPS Certificates habilitados no tailnet.)"
            }
        }

        # PUBLIC_URL precisa conter o host usado, senao o login recusa com 400
        if ($tsUrl -and $authEnabled) {
            if ($publicUrl -notlike "*$tsHost*") {
                Write-Warn "PUBLIC_URL no .env nao contem '$tsHost'."
                Write-Host "        O login recusaria o acesso por esse endereco (400 Host nao autorizado)."
                Write-Host "        Ajuste no .env (aceita varias URLs separadas por virgula):"
                Write-Host "          PUBLIC_URL=$tsUrl"
                Write-Host "        Depois rode: docker compose up -d --force-recreate"
            } else {
                Write-Ok "PUBLIC_URL cobre este endereco."
            }
        }
    } else {
        Write-Warn "Tailscale instalado, mas nao conectado. Rode: & '$tailscaleExe' up"
    }
} else {
    Write-Warn "Tailscale nao disponivel - o Dashboard ficara acessivel apenas em http://127.0.0.1:3000"
}

# ----------------------------------------------------------------------------
# Resumo final
# ----------------------------------------------------------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " Instalacao concluida!"                                      -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard (local):     http://127.0.0.1:3000"
if ($tsUrl) { Write-Host "  Dashboard (Tailscale): $tsUrl" }
Write-Host "  Modo de acesso:        $modoAcesso"
if ($authEnabled) {
    Write-Host "  Login com Google:      ATIVO - autorizados: $authEmails"
} else {
    Write-Host "  Login com Google:      DESATIVADO"
}
Write-Host ""
Write-Host "  Comandos uteis:"
Write-Host "    Logs ao vivo:        docker logs -f flex-bot-app"
Write-Host "    Reiniciar:           docker compose restart"
Write-Host "    Atualizar versao:    git pull; docker compose up -d --build --force-recreate"
Write-Host "    Backup dos dados:    Copy-Item -Recurse .\data C:\backups\flexbot-data"
if ($tailscaleExe) {
    Write-Host "    Status da exposicao: & '$tailscaleExe' funnel status"
    Write-Host "    Tornar privado:      & '$tailscaleExe' funnel --bg 3000 off"
    Write-Host "    Expor publicamente:  & '$tailscaleExe' funnel --bg 3000"
}
Write-Host ""

if ($exporPublico -and $authEnabled) {
    Write-Host "  O Dashboard esta PUBLICO na internet, protegido pelo login do Google." -ForegroundColor Yellow
    Write-Host "  Somente os e-mails da allowlist entram. Confirme no Google Console que"
    Write-Host "  esta cadastrado o redirect: $tsUrl/auth/callback"
} elseif (-not $authEnabled) {
    Write-Host "  Sem login configurado: mantenha o acesso restrito ao tailnet." -ForegroundColor Yellow
}
Write-Host ""
