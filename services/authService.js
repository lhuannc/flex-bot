/**
 * Autenticação do Dashboard via Google (OAuth 2.0 / OpenID Connect).
 *
 * O acesso é liberado APENAS para os e-mails listados em ALLOWED_EMAILS.
 * Autenticar no Google não basta: qualquer conta fora da lista é recusada.
 *
 * Implementação sem dependências externas — usa `fetch` e `node:crypto`
 * nativos do Node 22+. A sessão é um cookie assinado por HMAC-SHA256
 * (stateless), então não há store de sessão para manter ou escalar.
 */

import crypto from 'node:crypto';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export const SESSION_COOKIE = 'flexbot_session';
export const STATE_COOKIE = 'flexbot_oauth_state';

/** Validade da sessão, em horas */
const SESSION_TTL_HOURS = 12;

/**
 * Segredo usado para assinar a sessão.
 * Se SESSION_SECRET não estiver definido, gera um segredo aleatório em memória:
 * seguro, porém as sessões caem a cada reinício do container.
 */
let runtimeSecret = null;
function getSessionSecret() {
  const fromEnv = (process.env.SESSION_SECRET || '').trim();
  if (fromEnv) return fromEnv;

  if (!runtimeSecret) {
    runtimeSecret = crypto.randomBytes(32).toString('hex');
    console.warn(
      '[authService] SESSION_SECRET não definido no .env — usando segredo temporário. ' +
      'As sessões expiram a cada reinício. Defina SESSION_SECRET para sessões persistentes.'
    );
  }
  return runtimeSecret;
}

/**
 * A autenticação só entra em ação quando as credenciais do Google estão configuradas.
 * @returns {boolean}
 */
export function isAuthEnabled() {
  return Boolean(
    (process.env.GOOGLE_CLIENT_ID || '').trim() &&
    (process.env.GOOGLE_CLIENT_SECRET || '').trim()
  );
}

/**
 * Lista de e-mails autorizados (ALLOWED_EMAILS, separados por vírgula)
 * @returns {Array<string>} e-mails normalizados em minúsculas
 */
export function getAllowedEmails() {
  return (process.env.ALLOWED_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Verifica se o e-mail está na allowlist.
 * Lista vazia = ninguém entra (falha fechada, nunca aberta).
 * @param {string} email
 * @returns {boolean}
 */
export function isEmailAllowed(email) {
  if (!email) return false;
  const permitidos = getAllowedEmails();
  if (permitidos.length === 0) {
    console.error('[authService] ALLOWED_EMAILS está vazio — nenhum acesso será liberado.');
    return false;
  }
  return permitidos.includes(String(email).trim().toLowerCase());
}

// ---------------------------------------------------------------------------
// Sessão assinada (cookie stateless)
// ---------------------------------------------------------------------------

function sign(payloadB64) {
  return crypto.createHmac('sha256', getSessionSecret()).update(payloadB64).digest('base64url');
}

/**
 * Cria o token de sessão para um e-mail já autorizado
 * @param {string} email
 * @returns {string} token no formato <payload>.<assinatura>
 */
export function createSessionToken(email) {
  const payload = {
    email: String(email).toLowerCase(),
    exp: Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${payloadB64}.${sign(payloadB64)}`;
}

/**
 * Valida o token: assinatura, expiração e — importante — se o e-mail
 * AINDA está na allowlist. Remover alguém do .env derruba a sessão dele.
 * @param {string} token
 * @returns {{ email: string } | null}
 */
export function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;

  const [payloadB64, assinatura] = token.split('.');
  if (!payloadB64 || !assinatura) return null;

  const esperada = sign(payloadB64);

  // Comparação em tempo constante evita ataque de temporização na assinatura
  const a = Buffer.from(assinatura);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (!payload.exp || Date.now() > payload.exp) return null;
    if (!isEmailAllowed(payload.email)) return null;
    return { email: payload.email };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fluxo OAuth 2.0 com o Google
// ---------------------------------------------------------------------------

/**
 * Monta a URL de consentimento do Google
 * @param {string} redirectUri
 * @param {string} state - valor anti-CSRF, conferido no callback
 */
export function buildGoogleAuthUrl(redirectUri, state) {
  const params = new URLSearchParams({
    client_id: (process.env.GOOGLE_CLIENT_ID || '').trim(),
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    prompt: 'select_account'
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

/**
 * Troca o código de autorização pelo id_token e extrai a identidade.
 *
 * O id_token chega direto do endpoint de token do Google sobre TLS, então a
 * verificação de assinatura é dispensável (OpenID Connect Core §3.1.3.7).
 * Ainda assim conferimos `iss` e `aud` como defesa em profundidade.
 *
 * @param {string} code
 * @param {string} redirectUri
 * @returns {Promise<{success: boolean, email?: string, emailVerified?: boolean, name?: string, message?: string}>}
 */
export async function exchangeCodeForIdentity(code, redirectUri) {
  try {
    const resposta = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: (process.env.GOOGLE_CLIENT_ID || '').trim(),
        client_secret: (process.env.GOOGLE_CLIENT_SECRET || '').trim(),
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => '');
      console.error(`[authService] Google recusou a troca do código (${resposta.status}): ${detalhe}`);
      return { success: false, message: 'O Google recusou a autenticação. Confira as credenciais e a URI de redirecionamento.' };
    }

    const dados = await resposta.json();
    if (!dados.id_token) {
      return { success: false, message: 'Resposta do Google veio sem id_token.' };
    }

    const partes = dados.id_token.split('.');
    if (partes.length !== 3) {
      return { success: false, message: 'id_token em formato inválido.' };
    }

    const claims = JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf-8'));

    const emissorValido = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
    if (!emissorValido) {
      return { success: false, message: 'Emissor do token não é o Google.' };
    }

    if (claims.aud !== (process.env.GOOGLE_CLIENT_ID || '').trim()) {
      return { success: false, message: 'Token emitido para outro aplicativo.' };
    }

    return {
      success: true,
      email: claims.email,
      emailVerified: claims.email_verified === true,
      name: claims.name || claims.email
    };
  } catch (error) {
    console.error('[authService] Erro na troca do código OAuth:', error.message);
    return { success: false, message: 'Falha de comunicação com o Google.' };
  }
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

/**
 * Faz o parse do cabeçalho Cookie
 * @param {string} header
 * @returns {Record<string, string>}
 */
export function parseCookies(header) {
  const jar = {};
  if (!header) return jar;

  for (const parte of String(header).split(';')) {
    const idx = parte.indexOf('=');
    if (idx < 0) continue;
    const nome = parte.slice(0, idx).trim();
    const valor = parte.slice(idx + 1).trim();
    if (nome) jar[nome] = decodeURIComponent(valor);
  }
  return jar;
}

/**
 * Monta o cabeçalho Set-Cookie
 * @param {string} nome
 * @param {string} valor
 * @param {{ maxAge?: number, secure?: boolean }} opcoes
 */
export function serializeCookie(nome, valor, opcoes = {}) {
  const partes = [
    `${nome}=${encodeURIComponent(valor)}`,
    'Path=/',
    'HttpOnly',                 // inacessível a JavaScript — barra roubo por XSS
    'SameSite=Lax'              // bloqueia envio em POST cross-site (CSRF)
  ];

  if (typeof opcoes.maxAge === 'number') partes.push(`Max-Age=${opcoes.maxAge}`);
  if (opcoes.secure) partes.push('Secure');

  return partes.join('; ');
}

/**
 * Indica se a requisição chegou por HTTPS (o Tailscale Serve faz proxy
 * de HTTPS para o HTTP local e informa isso em X-Forwarded-Proto).
 * @param {import('express').Request} req
 */
export function isSecureRequest(req) {
  return req.protocol === 'https' || req.get('x-forwarded-proto') === 'https';
}
