import express from 'express';
import path from 'node:path';
import cors from 'cors';
import * as databaseService from '../services/databaseService.js';
import * as ruleService from '../services/ruleService.js';
import * as stoatService from '../services/stoatService.js';
import * as dmTriggerService from '../services/dmTriggerService.js';
import * as dmRuleService from '../services/dmRuleService.js';

export function createWebServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

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

    res.json({
      online: isOnline,
      botUser,
      serverName,
      totalMatriculas: databaseService.getMatriculas().length,
      totalRegras: ruleService.getRules().length,
      regrasAtivas: ruleService.getRules().filter(r => r.active).length
    });
  });

  // 2. Base de Matrículas (CRUD & Importação / Exclusão em Massa)
  app.get('/api/matriculas', (req, res) => {
    res.json(databaseService.getMatriculas());
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
