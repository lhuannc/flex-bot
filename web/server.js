import express from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import cors from 'cors';
import * as databaseService from '../services/databaseService.js';
import * as ruleService from '../services/ruleService.js';
import * as stoatService from '../services/stoatService.js';
import * as dmTriggerService from '../services/dmTriggerService.js';
import * as dmRuleService from '../services/dmRuleService.js';
import * as authService from '../services/authService.js';

export function createWebServer() {
  const app = express();

  // O Tailscale Serve termina o TLS e repassa por HTTP local:
  // sem confiar no proxy, o cookie de sessão não receberia a flag Secure.
  app.set('trust proxy', true);

  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  // =========================================================================
  // AUTENTICAÇÃO COM GOOGLE (ativa somente se GOOGLE_CLIENT_ID/SECRET existirem)
  // =========================================================================

  /**
   * Descobre a URL base desta requisição para montar o redirect_uri do OAuth.
   * O Host é validado contra localhost e PUBLIC_URL — aceitar qualquer Host
   * permitiria que um cabeçalho forjado desviasse o código de autorização.
   */
  function resolveBaseUrl(req) {
    const host = (req.get('host') || '').toLowerCase();
    const publicUrl = (process.env.PUBLIC_URL || '').trim().replace(/\/$/, '');

    if (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) {
      return `http://${host}`;
    }

    if (publicUrl) {
      try {
        if (new URL(publicUrl).host.toLowerCase() === host) return publicUrl;
      } catch {
        console.error(`[Auth] PUBLIC_URL inválida: "${publicUrl}"`);
      }
    }

    return null;
  }

  function redirectUriFor(req) {
    const base = resolveBaseUrl(req);
    return base ? `${base}/auth/callback` : null;
  }

  // Disponibiliza os cookies e a sessão já validada em todas as rotas
  app.use((req, res, next) => {
    req.cookies = authService.parseCookies(req.get('cookie'));
    req.session = authService.isAuthEnabled()
      ? authService.verifySessionToken(req.cookies[authService.SESSION_COOKIE])
      : { email: 'auth-desativada' };
    next();
  });

  // Início do fluxo: leva o usuário ao consentimento do Google
  app.get('/auth/login', (req, res) => {
    if (!authService.isAuthEnabled()) return res.redirect('/');

    const redirectUri = redirectUriFor(req);
    if (!redirectUri) {
      return res.status(400).send('Host não autorizado. Configure PUBLIC_URL no .env com o endereço usado para acessar o Dashboard.');
    }

    const state = crypto.randomBytes(16).toString('hex');
    res.setHeader('Set-Cookie', authService.serializeCookie(authService.STATE_COOKIE, state, {
      maxAge: 600,
      secure: authService.isSecureRequest(req)
    }));

    res.redirect(authService.buildGoogleAuthUrl(redirectUri, state));
  });

  // Retorno do Google: valida o state, troca o código e confere a allowlist
  app.get('/auth/callback', async (req, res) => {
    if (!authService.isAuthEnabled()) return res.redirect('/');

    const { code, state, error } = req.query;
    const seguro = authService.isSecureRequest(req);

    // Expira o cookie de state — ele serve para um único fluxo
    const limparState = authService.serializeCookie(authService.STATE_COOKIE, '', { maxAge: 0, secure: seguro });

    if (error) {
      res.setHeader('Set-Cookie', limparState);
      return res.redirect('/login.html?erro=cancelado');
    }

    const stateEsperado = req.cookies[authService.STATE_COOKIE];
    if (!state || !stateEsperado || state !== stateEsperado) {
      res.setHeader('Set-Cookie', limparState);
      console.warn('[Auth] Callback recusado: parâmetro state inválido (possível CSRF).');
      return res.redirect('/login.html?erro=state');
    }

    const redirectUri = redirectUriFor(req);
    if (!code || !redirectUri) {
      res.setHeader('Set-Cookie', limparState);
      return res.redirect('/login.html?erro=codigo');
    }

    const identidade = await authService.exchangeCodeForIdentity(code, redirectUri);

    if (!identidade.success) {
      res.setHeader('Set-Cookie', limparState);
      console.warn(`[Auth] Falha na autenticação: ${identidade.message}`);
      return res.redirect('/login.html?erro=google');
    }

    // Só e-mails verificados pelo Google e presentes na allowlist entram
    if (!identidade.emailVerified) {
      res.setHeader('Set-Cookie', limparState);
      return res.redirect('/login.html?erro=naoverificado');
    }

    if (!authService.isEmailAllowed(identidade.email)) {
      res.setHeader('Set-Cookie', limparState);
      console.warn(`[Auth] Acesso NEGADO para "${identidade.email}" (fora da allowlist).`);
      return res.redirect('/login.html?erro=naoautorizado');
    }

    const token = authService.createSessionToken(identidade.email);
    res.setHeader('Set-Cookie', [
      limparState,
      authService.serializeCookie(authService.SESSION_COOKIE, token, { maxAge: 12 * 60 * 60, secure: seguro })
    ]);

    console.log(`[Auth] Acesso liberado para ${identidade.email}.`);
    res.redirect('/');
  });

  app.get('/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', authService.serializeCookie(authService.SESSION_COOKIE, '', {
      maxAge: 0,
      secure: authService.isSecureRequest(req)
    }));
    res.redirect('/login.html');
  });

  // Identidade da sessão atual (usada pelo cabeçalho do Dashboard)
  app.get('/auth/me', (req, res) => {
    res.json({
      authEnabled: authService.isAuthEnabled(),
      authenticated: Boolean(req.session),
      email: req.session?.email || null
    });
  });

  // Barreira: tudo que não for público exige sessão válida
  const ROTAS_PUBLICAS = ['/login.html', '/style.css', '/favicon.ico'];

  app.use((req, res, next) => {
    if (!authService.isAuthEnabled()) return next();
    if (req.session) return next();
    if (req.path.startsWith('/auth/') || ROTAS_PUBLICAS.includes(req.path)) return next();

    // API responde 401 em JSON; navegação vai para a tela de login
    if (req.path.startsWith('/api/')) {
      return res.status(401).json({ error: 'Não autenticado.', loginUrl: '/auth/login' });
    }
    return res.redirect('/login.html');
  });

  app.use(express.static(path.join(import.meta.dirname, 'public')));

  // --- ROTAS DA API ---

  // 1. Status do Bot
  app.get('/api/status', async (req, res) => {
    const client = stoatService.getClient();
    const isOnline = stoatService.isReady();
    const botUser = isOnline ? client.user.username : 'Desconectado';

    const servers = await stoatService.getServers();
    const serverName = servers.length > 0
      ? (servers.length === 1 ? servers[0].name : `${servers.length} Servidores Conectados`)
      : 'Nenhum servidor encontrado';

    const totalMatriculas = databaseService.getMatriculas().length;
    const totalUsadas = Object.keys(databaseService.getUsos()).length;

    res.json({
      online: isOnline,
      botUser,
      serverName,
      totalMatriculas,
      totalUsadas,
      totalDisponiveis: Math.max(0, totalMatriculas - totalUsadas),
      totalRegras: ruleService.getRules().length,
      regrasAtivas: ruleService.getRules().filter(r => r.active).length
    });
  });

  // 2. Base de Matrículas (CRUD & Importação / Exclusão em Massa)
  app.get('/api/matriculas', (req, res) => {
    res.json(databaseService.getMatriculas());
  });

  // Registro de matrículas já consumidas: { "<matricula>": { userId, username, origin, usedAt } }
  app.get('/api/matriculas/usos', (req, res) => {
    res.json(databaseService.getUsos());
  });

  // Libera uma matrícula já utilizada, permitindo um novo uso
  app.post('/api/matriculas/:numero/liberar', (req, res) => {
    const { numero } = req.params;
    const success = databaseService.liberarMatricula(numero);
    if (!success) {
      return res.status(404).json({ error: 'Esta matrícula não possui registro de uso.' });
    }

    res.json({ success: true, usos: databaseService.getUsos() });
  });

  // Libera várias matrículas utilizadas de uma só vez
  app.post('/api/matriculas/liberar-bulk', (req, res) => {
    const { matriculas } = req.body;

    if (!Array.isArray(matriculas) || matriculas.length === 0) {
      return res.status(400).json({ error: 'Nenhuma matrícula selecionada para liberação.' });
    }

    let releasedCount = 0;
    for (const numero of matriculas) {
      if (databaseService.liberarMatricula(numero)) releasedCount++;
    }

    res.json({ success: true, releasedCount, usos: databaseService.getUsos() });
  });

  app.post('/api/matriculas', (req, res) => {
    const { numero } = req.body;
    if (!numero) {
      return res.status(400).json({ error: 'Número da matrícula é obrigatório.' });
    }

    const success = databaseService.adicionarMatricula(numero);
    if (!success) {
      return res.status(400).json({ error: 'Matrícula já existe na base de dados.' });
    }

    res.json({ success: true, matriculas: databaseService.getMatriculas() });
  });

  app.post('/api/matriculas/bulk', (req, res) => {
    const { rawData, matriculas } = req.body;
    const input = rawData || matriculas;

    if (!input) {
      return res.status(400).json({ error: 'Nenhum dado fornecido para importação.' });
    }

    const result = databaseService.adicionarMatriculasEmMassa(input);
    res.json({
      success: true,
      addedCount: result.addedCount,
      totalMatriculas: result.totalMatriculas,
      matriculas: result.matriculas
    });
  });

  app.post('/api/matriculas/delete-bulk', (req, res) => {
    const { matriculas } = req.body;

    if (!Array.isArray(matriculas) || matriculas.length === 0) {
      return res.status(400).json({ error: 'Nenhuma matrícula selecionada para exclusão.' });
    }

    const result = databaseService.removerMatriculasEmMassa(matriculas);
    res.json({
      success: true,
      removedCount: result.removedCount,
      totalMatriculas: result.totalMatriculas,
      matriculas: result.matriculas
    });
  });

  app.delete('/api/matriculas/:numero', (req, res) => {
    const { numero } = req.params;
    const success = databaseService.removerMatricula(numero);
    if (!success) {
      return res.status(404).json({ error: 'Matrícula não encontrada.' });
    }

    res.json({ success: true, matriculas: databaseService.getMatriculas() });
  });

  // 3. Regras de Liberação de Cargo Exclusivas para Canais (CRUD)
  app.get('/api/rules', (req, res) => {
    res.json(ruleService.getRules());
  });

  app.post('/api/rules', (req, res) => {
    const newRule = ruleService.createRule(req.body);
    res.json({ success: true, rule: newRule });
  });

  app.put('/api/rules/:id', (req, res) => {
    const { id } = req.params;
    const updated = ruleService.updateRule(id, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Regra não encontrada.' });
    }
    res.json({ success: true, rule: updated });
  });

  app.delete('/api/rules/:id', (req, res) => {
    const { id } = req.params;
    const deleted = ruleService.deleteRule(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Regra não encontrada.' });
    }
    res.json({ success: true });
  });

  // 4. Regras de DM e URA Multi-Nível
  app.get('/api/dm-rules', (req, res) => {
    res.json(dmRuleService.getDMRules());
  });

  app.post('/api/dm-rules', (req, res) => {
    dmRuleService.saveDMRules(req.body);
    res.json({ success: true, dmRules: dmRuleService.getDMRules() });
  });

  // 5. Gatilhos de Mensagem Direta (DM Triggers)
  app.get('/api/dm-triggers', (req, res) => {
    res.json(dmTriggerService.getDMTriggers());
  });

  app.post('/api/dm-triggers', (req, res) => {
    dmTriggerService.saveDMTriggers(req.body);
    res.json({ success: true, triggers: dmTriggerService.getDMTriggers() });
  });

  // Disparo de mensagem para membros que JÁ ESTÃO no servidor
  app.post('/api/dm-triggers/broadcast-existing', async (req, res) => {
    const { serverId, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Conteúdo da mensagem é obrigatório.' });
    }

    const result = await stoatService.broadcastToExistingMembers(serverId, message);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // 6. Integração Dinâmica com o Stoat (Servidores, Cargos e Canais)
  app.get('/api/stoat/servers', async (req, res) => {
    const servers = await stoatService.getServers();
    res.json(servers);
  });

  app.get('/api/stoat/servers/:serverId/roles', async (req, res) => {
    const { serverId } = req.params;
    const roles = await stoatService.getServerRoles(serverId);
    res.json(roles);
  });

  app.get('/api/stoat/servers/:serverId/channels', async (req, res) => {
    const { serverId } = req.params;
    const channels = await stoatService.getServerChannels(serverId);
    res.json(channels);
  });

  // Membros do servidor com seus cargos (para a área de Limpeza de Cargos)
  app.get('/api/stoat/servers/:serverId/members', async (req, res) => {
    const { serverId } = req.params;
    const members = await stoatService.getServerMembers(serverId);
    res.json(members);
  });

  // Limpeza de cargos em massa: remove cargos selecionados (ou todos) de vários membros
  app.post('/api/roles/cleanup', async (req, res) => {
    const { serverId, userIds, roleIds } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'Nenhum membro selecionado para a limpeza.' });
    }

    const removeAll = roleIds === 'ALL';
    if (!removeAll && (!Array.isArray(roleIds) || roleIds.length === 0)) {
      return res.status(400).json({ error: 'Nenhum cargo selecionado. Envie uma lista de cargos ou "ALL".' });
    }

    let changedCount = 0;
    let unchangedCount = 0;
    const failures = [];

    for (const userId of userIds) {
      const result = await stoatService.removeRolesFromMember(userId, removeAll ? 'ALL' : roleIds, serverId);

      if (!result.success) {
        failures.push({ userId, message: result.message });
      } else if (result.changed) {
        changedCount++;
      } else {
        unchangedCount++;
      }

      // Delay entre PATCHes para respeitar o rate-limit por servidor do Stoat
      if (userIds.length > 1) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }

    res.json({
      success: true,
      processed: userIds.length,
      changedCount,
      unchangedCount,
      failures
    });
  });

  // 7. Enviar DM Direta Individual
  app.post('/api/send-dm', async (req, res) => {
    const { userId, message } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: 'ID do Usuário e Mensagem são obrigatórios.' });
    }

    const result = await stoatService.sendDMToUser(userId, message);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  });

  return app;
}
