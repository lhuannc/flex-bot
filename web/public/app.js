document.addEventListener('DOMContentLoaded', () => {
  // Navigation Tabs
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');

  const titles = {
    'overview-tab': { title: 'Visão Geral do FlexBot', sub: 'Gerencie validações corporativas, base de matrículas, URA e mensagens diretas.' },
    'rules-tab': { title: 'Regras de Automação de Canais', sub: 'Configure regras exclusivas para validação de matrículas em canais de texto do Discord.' },
    'rule-editor-tab': { title: 'Cadastro de Regra de Canal', sub: 'Configure o servidor, cargo, canal exclusivo, tempo de auto-deleção e mensagens de resposta.' },
    'welcome-tab': { title: 'Regras de DM & URA Multi-Nível', sub: 'Configure disparos de mensagens privadas e a árvore de atendimento com sub-opções.' },
    'database-tab': { title: 'Base de Matrículas (matriculas.json)', sub: 'Gerencie as matrículas numéricas autorizadas no sistema.' },
    'dm-tab': { title: 'Envio de Mensagem Direta (DM)', sub: 'Dispare mensagens diretas no privado de usuários do Discord.' }
  };

  function switchTab(targetTabId) {
    navBtns.forEach(b => b.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));

    const activeNavBtn = Array.from(navBtns).find(b => b.getAttribute('data-tab') === targetTabId);
    if (activeNavBtn) activeNavBtn.classList.add('active');

    const targetElem = document.getElementById(targetTabId);
    if (targetElem) targetElem.classList.add('active');

    if (titles[targetTabId]) {
      pageTitle.textContent = titles[targetTabId].title;
      pageSubtitle.textContent = titles[targetTabId].sub;
    }
  }

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  // Global State Cache
  let guildsList = [];
  let currentGuildRoles = [];
  let currentGuildChannels = [];
  let rulesCache = [];
  let allMatriculasCache = [];
  let dmRulesState = { greeting: { enabled: true, message: '' }, ivrTree: [] };

  // Init Data Fetching
  fetchBotStatus();
  fetchRules();
  fetchDMTriggers();
  fetchDMRules();
  fetchMatriculas();
  fetchGuilds();

  document.getElementById('btn-refresh').addEventListener('click', () => {
    fetchBotStatus();
    fetchRules();
    fetchDMTriggers();
    fetchDMRules();
    fetchMatriculas();
    fetchGuilds();
    showToast('Dados do FlexBot e integrações atualizados!', 'success');
  });

  // --- 1. FETCH STATUS ---
  async function fetchBotStatus() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      document.getElementById('stat-matriculas').textContent = data.totalMatriculas;
      document.getElementById('stat-regras-ativas').textContent = `${data.regrasAtivas} / ${data.totalRegras}`;
      document.getElementById('stat-bot-online').textContent = data.online ? 'Online' : 'Desconectado';

      const badge = document.getElementById('bot-status-badge');
      const userTag = document.getElementById('bot-username');
      const guild = document.getElementById('bot-guild');

      if (data.online) {
        badge.className = 'status-indicator online';
        userTag.textContent = data.botUser;
        guild.textContent = data.guildName;
      } else {
        badge.className = 'status-indicator';
        userTag.textContent = 'Desconectado';
        guild.textContent = 'Verifique seu .env / Token';
      }
    } catch (err) {
      console.error('Erro ao buscar status:', err);
    }
  }

  // --- 2. FETCH DISCORD GUILDS, ROLES & CHANNELS ---
  async function fetchGuilds() {
    try {
      const res = await fetch('/api/discord/guilds');
      guildsList = await res.json();
      populateGuildSelectOptions();

      if (guildsList.length > 0) {
        const defaultGuildId = guildsList[0].id;
        await loadGlobalRoles(defaultGuildId);
      }
    } catch (err) {
      console.error('Erro ao buscar servidores (guilds):', err);
    }
  }

  async function loadGlobalRoles(guildId) {
    try {
      const rolesRes = await fetch(`/api/discord/guilds/${guildId}/roles`);
      currentGuildRoles = await rolesRes.json();
      renderURARootTree(); // Re-renderiza a URA para alimentar os selects de cargos
    } catch (err) {
      console.error('Erro ao buscar cargos globais:', err);
    }
  }

  function populateGuildSelectOptions() {
    const guildSelect = document.getElementById('rule-guild-id');
    guildSelect.innerHTML = '<option value="">Selecione o servidor do Discord...</option>';

    if (!guildsList || guildsList.length === 0) {
      guildSelect.innerHTML = '<option value="">Nenhum servidor encontrado (Bot desconectado ou sem servidores)</option>';
      return;
    }

    guildsList.forEach(g => {
      guildSelect.innerHTML += `<option value="${g.id}">${escapeHtml(g.name)} (ID: ${g.id})</option>`;
    });
  }

  const guildSelectElem = document.getElementById('rule-guild-id');
  guildSelectElem.addEventListener('change', async () => {
    const selectedGuildId = guildSelectElem.value;
    await loadGuildRolesAndChannels(selectedGuildId);
    await loadGlobalRoles(selectedGuildId);
  });

  async function loadGuildRolesAndChannels(guildId, targetRoleId = '', targetChannelId = '') {
    const roleSelect = document.getElementById('rule-role-id');
    const channelSelect = document.getElementById('rule-channel-id');

    if (!guildId) {
      roleSelect.innerHTML = '<option value="">Selecione um servidor primeiro...</option>';
      channelSelect.innerHTML = '<option value="">Selecione um servidor primeiro...</option>';
      return;
    }

    roleSelect.innerHTML = '<option value="">Buscando cargos no Discord...</option>';
    channelSelect.innerHTML = '<option value="">Buscando canais no Discord...</option>';

    try {
      const [rolesRes, channelsRes] = await Promise.all([
        fetch(`/api/discord/guilds/${guildId}/roles`),
        fetch(`/api/discord/guilds/${guildId}/channels`)
      ]);

      currentGuildRoles = await rolesRes.json();
      currentGuildChannels = await channelsRes.json();

      roleSelect.innerHTML = '<option value="">Selecione o cargo a atribuir...</option>';
      if (currentGuildRoles.length === 0) {
        roleSelect.innerHTML += '<option value="">Sem cargos encontrados neste servidor</option>';
      } else {
        currentGuildRoles.forEach(r => {
          const selected = r.id === targetRoleId ? 'selected' : '';
          roleSelect.innerHTML += `<option value="${r.id}" ${selected}>${escapeHtml(r.name)} (ID: ${r.id})</option>`;
        });
      }

      channelSelect.innerHTML = '<option value="">Selecione o canal exclusivo...</option>';
      currentGuildChannels.forEach(c => {
        const selected = c.id === targetChannelId ? 'selected' : '';
        channelSelect.innerHTML += `<option value="${c.id}" ${selected}>#${escapeHtml(c.name)} (ID: ${c.id})</option>`;
      });

    } catch (err) {
      console.error('Erro ao carregar cargos/canais do servidor:', err);
      roleSelect.innerHTML = '<option value="">Erro ao carregar cargos</option>';
      channelSelect.innerHTML = '<option value="">Erro ao carregar canais</option>';
    }
  }

  // --- 3. REGRAS DE CANAIS (CHANNEL RULES) ---
  async function fetchRules() {
    try {
      const res = await fetch('/api/rules');
      rulesCache = await res.json();
      renderRules(rulesCache);
    } catch (err) {
      console.error('Erro ao buscar regras:', err);
    }
  }

  function renderRules(rules) {
    const container = document.getElementById('rules-container');
    if (!rules || rules.length === 0) {
      container.innerHTML = '<p class="text-muted">Nenhuma regra de canal cadastrada. Clique em "Nova Regra de Canal" para criar.</p>';
      return;
    }

    container.innerHTML = rules.map(rule => {
      const guildName = guildsList.find(g => g.id === rule.guildId)?.name || (rule.guildId ? `Servidor ID: ${rule.guildId}` : 'Servidor Padrão');
      const roleBadge = rule.roleId ? `Role ID: ${rule.roleId}` : 'Cargo Padrão';
      const channelBadge = rule.allowedChannelId ? `Canal: #${currentGuildChannels.find(c => c.id === rule.allowedChannelId)?.name || rule.allowedChannelId}` : 'Canal Não Definido';
      const delayBadge = typeof rule.deleteDelaySeconds === 'number'
        ? (rule.deleteDelaySeconds === 0 ? 'Mensagem Permanente' : `Auto-Deletar: ${rule.deleteDelaySeconds}s`)
        : 'Auto-Deletar: 10s';

      return `
        <div class="rule-item">
          <div class="rule-info">
            <h4>
              <i class="fa-solid fa-hashtag" style="color: var(--primary-color);"></i>
              ${escapeHtml(rule.name)}
              <span class="badge ${rule.active ? 'badge-success' : 'badge-warning'}">
                ${rule.active ? 'Ativa' : 'Inativa'}
              </span>
            </h4>
            <p>${escapeHtml(rule.description || 'Sem descrição')}</p>
            <div class="rule-tags">
              <span class="badge badge-cyan"><i class="fa-solid fa-table"></i> Leitura: matriculas.json</span>
              <span class="badge badge-purple"><i class="fa-solid fa-server"></i> ${escapeHtml(guildName)}</span>
              <span class="badge badge-purple"><i class="fa-solid fa-user-shield"></i> ${escapeHtml(roleBadge)}</span>
              <span class="badge"><i class="fa-solid fa-hashtag"></i> ${escapeHtml(channelBadge)}</span>
              <span class="badge badge-warning"><i class="fa-solid fa-clock"></i> ${escapeHtml(delayBadge)}</span>
            </div>
          </div>
          <div class="rule-actions">
            <button class="btn btn-outline btn-edit-rule" data-id="${rule.id}"><i class="fa-solid fa-pen-to-square"></i> Editar</button>
            <button class="btn btn-danger btn-delete-rule" data-id="${rule.id}"><i class="fa-solid fa-trash"></i> Excluir</button>
          </div>
        </div>
      `;
    }).join('');

    document.querySelectorAll('.btn-edit-rule').forEach(btn => {
      btn.addEventListener('click', () => openRuleEditorPage(btn.dataset.id));
    });

    document.querySelectorAll('.btn-delete-rule').forEach(btn => {
      btn.addEventListener('click', () => deleteRule(btn.dataset.id));
    });
  }

  // FORMULÁRIO DE REGRA DE CANAL
  const formRule = document.getElementById('form-rule');

  document.getElementById('btn-add-rule').addEventListener('click', () => {
    openRuleEditorPage(null);
  });

  document.getElementById('btn-back-to-rules').addEventListener('click', () => {
    switchTab('rules-tab');
  });

  document.getElementById('btn-cancel-rule-page').addEventListener('click', () => {
    switchTab('rules-tab');
  });

  async function openRuleEditorPage(id) {
    populateGuildSelectOptions();

    if (id) {
      const rule = rulesCache.find(r => r.id === id);
      if (!rule) return;
      document.getElementById('rule-editor-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> Editar Regra de Canal';
      document.getElementById('rule-id').value = rule.id;
      document.getElementById('rule-name').value = rule.name;
      document.getElementById('rule-description').value = rule.description || '';
      document.getElementById('rule-guild-id').value = rule.guildId || '';

      if (rule.guildId) {
        await loadGuildRolesAndChannels(rule.guildId, rule.roleId, rule.allowedChannelId);
      } else {
        document.getElementById('rule-role-id').value = rule.roleId || '';
        document.getElementById('rule-channel-id').value = rule.allowedChannelId || '';
      }

      document.getElementById('rule-delete-delay').value = typeof rule.deleteDelaySeconds === 'number' ? rule.deleteDelaySeconds : 10;
      document.getElementById('rule-success-msg').value = rule.successMessage || '';
      document.getElementById('rule-error-msg').value = rule.errorMessage || '';
      document.getElementById('rule-active').checked = rule.active !== false;
    } else {
      document.getElementById('rule-editor-title').innerHTML = '<i class="fa-solid fa-plus-circle"></i> Cadastrar Nova Regra de Canal';
      formRule.reset();
      document.getElementById('rule-id').value = '';
      document.getElementById('rule-delete-delay').value = 10;
      document.getElementById('rule-success-msg').value = '✅ **Acesso Liberado!** {user}, sua matrícula foi validada com sucesso.';
      document.getElementById('rule-error-msg').value = '❌ {user}: **Matrícula não encontrada.** Verifique os 8 números digitados.';
      document.getElementById('rule-active').checked = true;

      if (guildsList && guildsList.length > 0) {
        const defaultGuildId = guildsList[0].id;
        document.getElementById('rule-guild-id').value = defaultGuildId;
        await loadGuildRolesAndChannels(defaultGuildId);
      }
    }

    switchTab('rule-editor-tab');
  }

  formRule.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('rule-id').value;

    const payload = {
      name: document.getElementById('rule-name').value,
      description: document.getElementById('rule-description').value,
      matchType: 'DATABASE',
      triggerValue: '',
      guildId: document.getElementById('rule-guild-id').value,
      roleId: document.getElementById('rule-role-id').value,
      allowedChannelId: document.getElementById('rule-channel-id').value,
      deleteDelaySeconds: parseInt(document.getElementById('rule-delete-delay').value, 10) || 0,
      enableDM: false,
      isIVR: false,
      successMessage: document.getElementById('rule-success-msg').value,
      errorMessage: document.getElementById('rule-error-msg').value,
      active: document.getElementById('rule-active').checked
    };

    try {
      let res;
      if (id) {
        res = await fetch(`/api/rules/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch('/api/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      const data = await res.json();
      if (data.success) {
        showToast(id ? 'Regra de canal atualizada!' : 'Nova regra de canal criada!', 'success');
        switchTab('rules-tab');
        fetchRules();
        fetchBotStatus();
      } else {
        showToast(data.error || 'Erro ao salvar regra.', 'error');
      }
    } catch (err) {
      console.error('Erro ao salvar regra de canal:', err);
      showToast('Erro de conexão.', 'error');
    }
  });

  async function deleteRule(id) {
    if (!confirm('Tem certeza que deseja excluir esta regra de canal?')) return;

    try {
      const res = await fetch(`/api/rules/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Regra de canal removida.', 'success');
        fetchRules();
        fetchBotStatus();
      }
    } catch (err) {
      showToast('Erro ao excluir regra.', 'error');
    }
  }

  // --- 4. REGRAS DE DM & URA MULTI-NÍVEL (SELECT DINÂMICO DE CARGOS DO DISCORD) ---
  async function fetchDMRules() {
    try {
      const res = await fetch('/api/dm-rules');
      dmRulesState = await res.json();

      document.getElementById('ura-greeting-msg').value = dmRulesState.greeting?.message || '';
      renderURARootTree();
    } catch (err) {
      console.error('Erro ao carregar regras de DM/URA:', err);
    }
  }

  function generateRoleSelectHTML(selectedRoleId, onchangeAttr) {
    let optionsHTML = '<option value="">Selecione o cargo no servidor...</option>';
    if (currentGuildRoles && currentGuildRoles.length > 0) {
      currentGuildRoles.forEach(r => {
        const sel = r.id === selectedRoleId ? 'selected' : '';
        optionsHTML += `<option value="${r.id}" ${sel}>${escapeHtml(r.name)} (ID: ${r.id})</option>`;
      });
    } else if (selectedRoleId) {
      optionsHTML += `<option value="${selectedRoleId}" selected>Cargo ID: ${selectedRoleId}</option>`;
    }
    return `<select ${onchangeAttr}>${optionsHTML}</select>`;
  }

  document.getElementById('btn-add-root-option').addEventListener('click', () => {
    if (!dmRulesState.ivrTree) dmRulesState.ivrTree = [];

    const newIdx = dmRulesState.ivrTree.length + 1;
    dmRulesState.ivrTree.push({
      id: 'opt-' + Date.now(),
      trigger: `${newIdx}`,
      label: `${newIdx} - Nova Opção`,
      consequences: {
        sendMessage: false,
        responseMessage: '',
        assignRole: false,
        roleId: '',
        requestMatricula: true,
        promptMessage: 'Por favor, digite sua matrícula oficial:',
        openSubmenu: false,
        submenuPrompt: '',
        suboptions: []
      }
    });

    renderURARootTree();
  });

  function renderURARootTree() {
    const container = document.getElementById('ura-root-options-container');
    const tree = dmRulesState.ivrTree || [];

    if (tree.length === 0) {
      container.innerHTML = '<p class="text-muted">Nenhuma opção configurada no menu de URA. Clique abaixo para adicionar.</p>';
      return;
    }

    container.innerHTML = tree.map((rootOpt, rIdx) => {
      const cons = rootOpt.consequences || {
        sendMessage: rootOpt.actionType === 'MESSAGE_ONLY' || !!rootOpt.responseMessage,
        responseMessage: rootOpt.responseMessage || '',
        assignRole: !!rootOpt.roleId && !rootOpt.requestMatricula,
        roleId: rootOpt.roleId || '',
        requestMatricula: rootOpt.actionType === 'MATRICULA_VALIDATION',
        promptMessage: rootOpt.promptMessage || 'Por favor, digite sua matrícula:',
        openSubmenu: rootOpt.actionType === 'SUBMENU' || (Array.isArray(rootOpt.suboptions) && rootOpt.suboptions.length > 0),
        submenuPrompt: rootOpt.submenuPrompt || '',
        suboptions: rootOpt.suboptions || []
      };
      rootOpt.consequences = cons;

      return `
        <div class="ivr-option-card">
          <div class="ivr-option-header">
            <strong><i class="fa-solid fa-folder-tree" style="color: var(--color-primary);"></i> Opção ${rIdx + 1} (Nível Principal)</strong>
            <button type="button" class="btn btn-danger btn-sm" onclick="removeURARootOption(${rIdx})"><i class="fa-solid fa-trash"></i> Remover</button>
          </div>

          <div class="form-row">
            <div class="form-group" style="flex: 1;">
              <label>Gatilho (Número/Tecla)</label>
              <input type="text" value="${escapeHtml(rootOpt.trigger || `${rIdx + 1}`)}" onchange="updateRootOpt(${rIdx}, 'trigger', this.value)">
            </div>
            <div class="form-group" style="flex: 3;">
              <label>Rótulo da Opção (Texto no Menu)</label>
              <input type="text" value="${escapeHtml(rootOpt.label || '')}" onchange="updateRootOpt(${rIdx}, 'label', this.value)">
            </div>
          </div>

          <!-- BLOCO DE CONSEQUÊNCIAS DA AÇÃO COMBINÁVEIS (E/OU) -->
          <div style="background: rgba(19, 51, 90, 0.04); padding: 14px; border-radius: var(--radius-sm); border: 1px solid var(--color-border-light);">
            <label style="font-weight: 800; color: var(--color-primary); margin-bottom: 8px; display: block;">
              ⚡ Consequências da Ação ao Selecionar esta Opção (Marque todas que desejar - E/OU):
            </label>

            <!-- 1. ENVIAR MENSAGEM / RESPOSTA -->
            <div class="form-group checkbox-group" style="margin-bottom: 8px;">
              <label class="switch">
                <input type="checkbox" ${cons.sendMessage ? 'checked' : ''} onchange="toggleRootCons(${rIdx}, 'sendMessage', this.checked)">
                <span class="slider round"></span>
              </label>
              <span>💬 Enviar Mensagem / Resposta / Link Direto</span>
            </div>
            ${cons.sendMessage ? `
              <div class="form-group" style="margin-left: 56px; margin-bottom: 12px;">
                <textarea rows="2" placeholder="Digite o texto ou link do canal a enviar..." onchange="updateRootCons(${rIdx}, 'responseMessage', this.value)">${escapeHtml(cons.responseMessage || '')}</textarea>
              </div>
            ` : ''}

            <!-- 2. ATRIBUIR CARGO DIRETO NO DISCORD (SELECT DROPDOWN) -->
            <div class="form-group checkbox-group" style="margin-bottom: 8px;">
              <label class="switch">
                <input type="checkbox" ${cons.assignRole ? 'checked' : ''} onchange="toggleRootCons(${rIdx}, 'assignRole', this.checked)">
                <span class="slider round"></span>
              </label>
              <span>🏷️ Atribuir Cargo Direto no Discord (Role)</span>
            </div>
            ${cons.assignRole ? `
              <div class="form-group" style="margin-left: 56px; margin-bottom: 12px;">
                <label style="font-size: 0.82rem;">Selecione o Cargo do Servidor:</label>
                ${generateRoleSelectHTML(cons.roleId, `onchange="updateRootCons(${rIdx}, 'roleId', this.value)"`)}
              </div>
            ` : ''}

            <!-- 3. SOLICITAR VALIDAÇÃO DE MATRÍCULA -->
            <div class="form-group checkbox-group" style="margin-bottom: 8px;">
              <label class="switch">
                <input type="checkbox" ${cons.requestMatricula ? 'checked' : ''} onchange="toggleRootCons(${rIdx}, 'requestMatricula', this.checked)">
                <span class="slider round"></span>
              </label>
              <span>🎓 Solicitar Validação de Matrícula (Consulta matriculas.json & Atribui Cargo)</span>
            </div>
            ${cons.requestMatricula ? `
              <div class="form-group" style="margin-left: 56px; margin-bottom: 12px;">
                <input type="text" placeholder="Mensagem solicitando matrícula..." value="${escapeHtml(cons.promptMessage || '')}" onchange="updateRootCons(${rIdx}, 'promptMessage', this.value)">
                <label style="font-size: 0.82rem; margin-top: 8px;">Selecione o Cargo a Atribuir ao Validar a Matrícula:</label>
                ${generateRoleSelectHTML(cons.roleId, `onchange="updateRootCons(${rIdx}, 'roleId', this.value)"`)}
              </div>
            ` : ''}

            <!-- 4. ABRIR NOVO NÍVEL / SUBMENU (OPÇÕES DENTRO DE OPÇÕES!) -->
            <div class="form-group checkbox-group">
              <label class="switch">
                <input type="checkbox" ${cons.openSubmenu ? 'checked' : ''} onchange="toggleRootCons(${rIdx}, 'openSubmenu', this.checked)">
                <span class="slider round"></span>
              </label>
              <span>🌳 Abrir Novo Nível / Submenu (Opções dentro de opções!)</span>
            </div>
            ${cons.openSubmenu ? `
              <div class="suboptions-box" style="margin-left: 56px;">
                <h5><i class="fa-solid fa-code-branch"></i> Submenu - Nível de Opções Secundárias</h5>
                <div class="form-group" style="margin-bottom: 12px;">
                  <label>Título do Submenu</label>
                  <input type="text" placeholder="Ex: Selecione o seu curso ou área:" value="${escapeHtml(cons.submenuPrompt || '')}" onchange="updateRootCons(${rIdx}, 'submenuPrompt', this.value)">
                </div>

                <div id="suboptions-container-${rIdx}">
                  ${renderURASuboptions(rIdx, cons.suboptions || [])}
                </div>

                <button type="button" class="btn btn-outline btn-sm" onclick="addURASuboption(${rIdx})" style="margin-top: 10px;">
                  <i class="fa-solid fa-plus"></i> Adicionar Sub-opção (${rIdx + 1}.x)
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function renderURASuboptions(rIdx, suboptions) {
    if (!suboptions || suboptions.length === 0) {
      return '<p class="text-muted" style="font-size: 0.82rem;">Nenhuma sub-opção configurada neste submenu.</p>';
    }

    return suboptions.map((sub, sIdx) => {
      const sCons = sub.consequences || {
        sendMessage: !!sub.responseMessage,
        responseMessage: sub.responseMessage || '',
        assignRole: !!sub.roleId && !sub.requestMatricula,
        roleId: sub.roleId || '',
        requestMatricula: true,
        promptMessage: sub.promptMessage || 'Por favor, digite sua matrícula:'
      };
      sub.consequences = sCons;

      return `
        <div class="ivr-option-card" style="background: var(--color-white); border-color: rgba(42, 104, 143, 0.3);">
          <div class="ivr-option-header">
            <small><strong>Sub-opção ${rIdx + 1}.${sIdx + 1}</strong></small>
            <button type="button" class="btn btn-danger btn-sm" onclick="removeURASuboption(${rIdx}, ${sIdx})"><i class="fa-solid fa-trash"></i></button>
          </div>
          <div class="form-row">
            <input type="text" placeholder="Gatilho (ex: 1)" value="${escapeHtml(sub.trigger || `${sIdx + 1}`)}" onchange="updateSubOpt(${rIdx}, ${sIdx}, 'trigger', this.value)">
            <input type="text" placeholder="Rótulo (ex: 1 - Aluno Graduação)" value="${escapeHtml(sub.label || '')}" onchange="updateSubOpt(${rIdx}, ${sIdx}, 'label', this.value)">
          </div>

          <div class="form-group checkbox-group">
            <label class="switch">
              <input type="checkbox" ${sCons.requestMatricula ? 'checked' : ''} onchange="toggleSubCons(${rIdx}, ${sIdx}, 'requestMatricula', this.checked)">
              <span class="slider round"></span>
            </label>
            <span>🎓 Pedir Matrícula nesta Sub-opção</span>
          </div>

          <input type="text" placeholder="Mensagem solicitando a matrícula" value="${escapeHtml(sCons.promptMessage || sub.promptMessage || '')}" onchange="updateSubCons(${rIdx}, ${sIdx}, 'promptMessage', this.value)">
          
          <label style="font-size: 0.82rem; margin-top: 6px;">Selecione o Cargo a Atribuir no Discord:</label>
          ${generateRoleSelectHTML(sCons.roleId || sub.roleId, `onchange="updateSubCons(${rIdx}, ${sIdx}, 'roleId', this.value)"`)}
        </div>
      `;
    }).join('');
  }

  // MUTATORS PARA URA MULTI-NÍVEL & CONSEQUÊNCIAS
  window.removeURARootOption = (idx) => {
    dmRulesState.ivrTree.splice(idx, 1);
    renderURARootTree();
  };

  window.updateRootOpt = (idx, field, val) => {
    if (dmRulesState.ivrTree[idx]) {
      dmRulesState.ivrTree[idx][field] = val;
    }
  };

  window.toggleRootCons = (idx, consField, checked) => {
    if (dmRulesState.ivrTree[idx]) {
      if (!dmRulesState.ivrTree[idx].consequences) {
        dmRulesState.ivrTree[idx].consequences = {};
      }
      dmRulesState.ivrTree[idx].consequences[consField] = checked;
      renderURARootTree();
    }
  };

  window.updateRootCons = (idx, field, val) => {
    if (dmRulesState.ivrTree[idx] && dmRulesState.ivrTree[idx].consequences) {
      dmRulesState.ivrTree[idx].consequences[field] = val;
    }
  };

  window.addURASuboption = (rIdx) => {
    const cons = dmRulesState.ivrTree[rIdx].consequences;
    if (!cons.suboptions) cons.suboptions = [];

    const sLen = cons.suboptions.length + 1;
    cons.suboptions.push({
      id: `sub-${rIdx}-${Date.now()}`,
      trigger: `${sLen}`,
      label: `${sLen} - Sub-opção`,
      consequences: {
        sendMessage: false,
        responseMessage: '',
        assignRole: false,
        roleId: '',
        requestMatricula: true,
        promptMessage: 'Por favor, digite sua matrícula:'
      }
    });
    renderURARootTree();
  };

  window.removeURASuboption = (rIdx, sIdx) => {
    dmRulesState.ivrTree[rIdx].consequences.suboptions.splice(sIdx, 1);
    renderURARootTree();
  };

  window.updateSubOpt = (rIdx, sIdx, field, val) => {
    const sub = dmRulesState.ivrTree[rIdx]?.consequences?.suboptions?.[sIdx];
    if (sub) sub[field] = val;
  };

  window.toggleSubCons = (rIdx, sIdx, field, checked) => {
    const sub = dmRulesState.ivrTree[rIdx]?.consequences?.suboptions?.[sIdx];
    if (sub) {
      if (!sub.consequences) sub.consequences = {};
      sub.consequences[field] = checked;
      renderURARootTree();
    }
  };

  window.updateSubCons = (rIdx, sIdx, field, val) => {
    const sub = dmRulesState.ivrTree[rIdx]?.consequences?.suboptions?.[sIdx];
    if (sub) {
      if (!sub.consequences) sub.consequences = {};
      sub.consequences[field] = val;
    }
  };

  // SALVAR FORMULÁRIO DA URA MULTI-NÍVEL
  document.getElementById('form-ura-tree').addEventListener('submit', async (e) => {
    e.preventDefault();

    dmRulesState.greeting = {
      enabled: true,
      message: document.getElementById('ura-greeting-msg').value
    };

    try {
      const res = await fetch('/api/dm-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dmRulesState)
      });
      const data = await res.json();

      if (data.success) {
        showToast('Árvore de URA e Consequências salvas com sucesso!', 'success');
      } else {
        showToast('Erro ao salvar URA.', 'error');
      }
    } catch (err) {
      console.error('Erro ao salvar URA:', err);
      showToast('Erro de conexão.', 'error');
    }
  });

  // GATILHOS DE DM (DM TRIGGERS)
  async function fetchDMTriggers() {
    try {
      const res = await fetch('/api/dm-triggers');
      const data = await res.json();

      document.getElementById('trigger-server-join-enabled').checked = data.serverJoin?.enabled !== false;
      document.getElementById('trigger-keyword-enabled').checked = data.keywordGreeting?.enabled !== false;

      const kwList = Array.isArray(data.keywordGreeting?.keywords)
        ? data.keywordGreeting.keywords.join(', ')
        : 'oi, olá, ajuda, matricula';
      document.getElementById('trigger-keywords-list').value = kwList;
    } catch (err) {
      console.error('Erro ao buscar gatilhos de DM:', err);
    }
  }

  document.getElementById('form-dm-triggers').addEventListener('submit', async (e) => {
    e.preventDefault();

    const rawKeywords = document.getElementById('trigger-keywords-list').value;
    const keywordsArray = rawKeywords.split(',').map(k => k.trim()).filter(Boolean);

    const payload = {
      serverJoin: {
        enabled: document.getElementById('trigger-server-join-enabled').checked,
        message: '👋 **Seja bem-vindo(a) ao servidor!**'
      },
      keywordGreeting: {
        enabled: document.getElementById('trigger-keyword-enabled').checked,
        keywords: keywordsArray,
        message: ''
      }
    };

    try {
      const res = await fetch('/api/dm-triggers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success) {
        showToast('Gatilhos de DM salvos com sucesso!', 'success');
      } else {
        showToast('Erro ao salvar gatilhos de DM.', 'error');
      }
    } catch (err) {
      showToast('Erro de conexão.', 'error');
    }
  });

  // --- 5. BASE DE MATRÍCULAS COM CAMPO DE PESQUISA EM TEMPO REAL ---
  async function fetchMatriculas() {
    try {
      const res = await fetch('/api/matriculas');
      allMatriculasCache = await res.json();
      filterAndRenderMatriculas();
    } catch (err) {
      console.error('Erro ao buscar matrículas:', err);
    }
  }

  const searchInput = document.getElementById('input-search-matricula');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      filterAndRenderMatriculas();
    });
  }

  function filterAndRenderMatriculas() {
    const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const filtered = allMatriculasCache.filter(m => m.toLowerCase().includes(query));
    renderMatriculasTable(filtered);
  }

  function renderMatriculasTable(list) {
    const tbody = document.getElementById('matriculas-table-body');
    if (!list || list.length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: var(--color-text-muted); padding: 24px;">Nenhuma matrícula encontrada.</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((item, idx) => `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(item)}</strong></td>
        <td><span class="badge badge-success">Válida</span></td>
        <td>
          <button class="btn btn-danger btn-delete-matricula" data-numero="${escapeHtml(item)}">
            <i class="fa-solid fa-trash"></i> Remover
          </button>
        </td>
      </tr>
    `).join('');

    document.querySelectorAll('.btn-delete-matricula').forEach(btn => {
      btn.addEventListener('click', () => deleteMatricula(btn.dataset.numero));
    });
  }

  document.getElementById('form-add-matricula-bulk').addEventListener('submit', async (e) => {
    e.preventDefault();
    const textarea = document.getElementById('input-bulk-matriculas');
    const textData = textarea.value.trim();

    if (!textData) {
      showToast('Por favor, insira as matrículas na área de texto.', 'error');
      return;
    }

    const btnSubmit = document.getElementById('btn-submit-bulk-text');
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Cadastrando...';

    try {
      const res = await fetch('/api/matriculas/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawData: textData })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`🎉 Sucesso! ${data.addedCount} novas matrículas cadastradas na base. Total: ${data.totalMatriculas}`, 'success');
        textarea.value = '';
        allMatriculasCache = data.matriculas;
        filterAndRenderMatriculas();
        fetchBotStatus();
      } else {
        showToast(data.error || 'Erro ao cadastrar matrículas.', 'error');
      }
    } catch (err) {
      console.error('Erro ao cadastrar matrículas:', err);
      showToast('Erro de comunicação com o servidor.', 'error');
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<i class="fa-solid fa-plus-circle"></i> Cadastrar Matrículas na Base';
    }
  });

  async function deleteMatricula(numero) {
    if (!confirm(`Deseja remover a matrícula ${numero} da base?`)) return;

    try {
      const res = await fetch(`/api/matriculas/${encodeURIComponent(numero)}`, { method: 'DELETE' });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(`Matrícula ${numero} removida.`, 'success');
        allMatriculasCache = data.matriculas;
        filterAndRenderMatriculas();
        fetchBotStatus();
      } else {
        showToast(data.error || 'Erro ao remover matrícula.', 'error');
      }
    } catch (err) {
      showToast('Erro ao remover matrícula.', 'error');
    }
  }

  // --- 6. ENVIAR DM ---
  document.getElementById('form-send-dm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const userId = document.getElementById('dm-user-id').value.trim();
    const message = document.getElementById('dm-message').value.trim();
    const btn = document.getElementById('btn-submit-dm');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Enviando...';

    try {
      const res = await fetch('/api/send-dm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, message })
      });
      const data = await res.json();

      if (res.ok && data.success) {
        showToast(data.message, 'success');
        document.getElementById('dm-message').value = '';
      } else {
        showToast(data.message || data.error || 'Falha ao enviar DM.', 'error');
      }
    } catch (err) {
      showToast('Erro ao conectar com o servidor.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Disparar Mensagem Direta';
    }
  });

  // --- UTILS ---
  function showToast(msg, type = 'success') {
    const toast = document.getElementById('toast-notification');
    toast.className = `toast show ${type}`;
    toast.innerHTML = type === 'success' 
      ? `<i class="fa-solid fa-circle-check"></i> ${msg}`
      : `<i class="fa-solid fa-circle-xmark"></i> ${msg}`;

    setTimeout(() => {
      toast.className = 'toast';
    }, 4000);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, match => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[match]));
  }
});
