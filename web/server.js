const express = require('express');
const path = require('path');
const cors = require('cors');
const databaseService = require('../services/databaseService');
const ruleService = require('../services/ruleService');
const discordService = require('../services/discordService');
const dmTriggerService = require('../services/dmTriggerService');
const dmRuleService = require('../services/dmRuleService');

function createWebServer() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));

  app.use(express.static(path.join(__dirname, 'public')));

  // --- ROTAS DA API ---

  // 1. Status do Bot
  app.get('/api/status', async (req, res) => {
    const client = discordService.getClient();
    const isOnline = client && client.readyAt ? true : false;
    const botUser = isOnline ? client.user.tag : 'Desconectado';

    const guilds = await discordService.getGuilds();
    const guildName = guilds.length > 0 
      ? (guilds.length === 1 ? guilds[0].name : `${guilds.length} Servidores Conectados`)
      : 'Nenhum servidor encontrado';

    res.json({
      online: isOnline,
      botUser,
      guildName,
      totalMatriculas: databaseService.getMatriculas().length,
      totalRegras: ruleService.getRules().length,
      regrasAtivas: ruleService.getRules().filter(r => r.active).length
    });
  });

  // 2. Base de Matrículas (CRUD & Importação em Massa)
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
    const { guildId, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Conteúdo da mensagem é obrigatório.' });
    }

    const result = await discordService.broadcastToExistingMembers(guildId, message);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  });

  // 6. Integração Dinâmica com o Discord (Servidores, Cargos e Canais)
  app.get('/api/discord/guilds', async (req, res) => {
    const guilds = await discordService.getGuilds();
    res.json(guilds);
  });

  app.get('/api/discord/guilds/:guildId/roles', async (req, res) => {
    const { guildId } = req.params;
    const roles = await discordService.getGuildRoles(guildId);
    res.json(roles);
  });

  app.get('/api/discord/guilds/:guildId/channels', async (req, res) => {
    const { guildId } = req.params;
    const channels = await discordService.getGuildChannels(guildId);
    res.json(channels);
  });

  // 7. Enviar DM Direta Individual
  app.post('/api/send-dm', async (req, res) => {
    const { userId, message } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: 'ID do Usuário e Mensagem são obrigatórios.' });
    }

    const result = await discordService.sendDMToUser(userId, message);
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  });

  return app;
}

module.exports = { createWebServer };
