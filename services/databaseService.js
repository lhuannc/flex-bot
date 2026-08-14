import fs from 'node:fs';
import path from 'node:path';

const MATRICULAS_FILE = path.join(import.meta.dirname, '../data/matriculas.json');
const USOS_FILE = path.join(import.meta.dirname, '../data/matriculas_usos.json');

/**
 * Garantir que o diretório e arquivo de matrículas existam
 */
function ensureFileExists() {
  try {
    const dir = path.dirname(MATRICULAS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(MATRICULAS_FILE)) {
      fs.writeFileSync(MATRICULAS_FILE, JSON.stringify(["12345678", "87654321"], null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('[databaseService] Erro ao verificar/criar diretório data:', err);
  }
}

/**
 * Garante a existência do arquivo de registro de usos (matrículas já consumidas)
 */
function ensureUsosFileExists() {
  try {
    const dir = path.dirname(USOS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(USOS_FILE)) {
      fs.writeFileSync(USOS_FILE, JSON.stringify({}, null, 2), 'utf-8');
    }
  } catch (err) {
    console.error('[databaseService] Erro ao verificar/criar matriculas_usos.json:', err);
  }
}

/**
 * Retorna todas as matrículas cadastradas
 * @returns {Array<string>}
 */
export function getMatriculas() {
  try {
    ensureFileExists();
    const data = fs.readFileSync(MATRICULAS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('[databaseService] Erro ao ler matrículas:', error);
    return [];
  }
}

/**
 * Retorna o mapa completo de usos: { "<matricula>": { userId, username, usedAt, origin } }
 * @returns {Record<string, { userId: string, username: string, usedAt: string, origin: string }>}
 */
export function getUsos() {
  try {
    ensureUsosFileExists();
    const data = fs.readFileSync(USOS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    console.error('[databaseService] Erro ao ler registro de usos:', error);
    return {};
  }
}

/**
 * Salva o mapa de usos no disco
 * @param {Record<string, object>} usos
 */
function saveUsos(usos) {
  try {
    ensureUsosFileExists();
    fs.writeFileSync(USOS_FILE, JSON.stringify(usos, null, 2), 'utf-8');
  } catch (err) {
    console.error('[databaseService] Erro ao salvar registro de usos no disco:', err);
  }
}

/**
 * Indica se a matrícula já foi consumida por algum usuário
 * @param {string} matricula
 * @returns {boolean}
 */
export function isMatriculaUsada(matricula) {
  if (!matricula) return false;
  return Boolean(getUsos()[String(matricula).trim()]);
}

/**
 * Consulta completa: informa se a matrícula existe na base e se já foi utilizada
 * @param {string} matricula
 * @returns {{ existe: boolean, usada: boolean, uso: object|null }}
 */
export function consultarMatricula(matricula) {
  const normalizada = String(matricula ?? '').trim();
  if (!normalizada) return { existe: false, usada: false, uso: null };

  const existe = getMatriculas().includes(normalizada);
  const uso = getUsos()[normalizada] || null;

  return { existe, usada: Boolean(uso), uso };
}

/**
 * Verifica se a matrícula existe na base de dados E ainda não foi utilizada.
 * Uma matrícula só pode liberar acesso uma única vez.
 * @param {string} matricula
 * @returns {boolean}
 */
export function validarMatricula(matricula) {
  const { existe, usada } = consultarMatricula(matricula);
  return existe && !usada;
}

/**
 * Marca a matrícula como utilizada (consumo definitivo).
 * A checagem e a gravação acontecem na mesma chamada para evitar consumo duplicado.
 * @param {string} matricula
 * @param {{ userId?: string, username?: string, origin?: string }} meta
 * @returns {{ success: boolean, motivo: 'NAO_ENCONTRADA'|'JA_UTILIZADA'|null, uso: object|null }}
 */
export function consumirMatricula(matricula, meta = {}) {
  const normalizada = String(matricula ?? '').trim();
  if (!normalizada) return { success: false, motivo: 'NAO_ENCONTRADA', uso: null };

  if (!getMatriculas().includes(normalizada)) {
    return { success: false, motivo: 'NAO_ENCONTRADA', uso: null };
  }

  const usos = getUsos();
  if (usos[normalizada]) {
    return { success: false, motivo: 'JA_UTILIZADA', uso: usos[normalizada] };
  }

  const registro = {
    userId: meta.userId ? String(meta.userId) : '',
    username: meta.username ? String(meta.username) : '',
    origin: meta.origin ? String(meta.origin) : 'DESCONHECIDA',
    usedAt: new Date().toISOString()
  };

  usos[normalizada] = registro;
  saveUsos(usos);

  console.log(`[databaseService] Matrícula ${normalizada} consumida por ${registro.username || registro.userId || 'usuário desconhecido'} (${registro.origin}).`);
  return { success: true, motivo: null, uso: registro };
}

/**
 * Libera novamente uma matrícula já utilizada (desfaz o consumo).
 * Usado pelo painel administrativo e como rollback quando a atribuição de cargo falha.
 * @param {string} matricula
 * @returns {boolean} true se havia um uso registrado e ele foi removido
 */
export function liberarMatricula(matricula) {
  const normalizada = String(matricula ?? '').trim();
  if (!normalizada) return false;

  const usos = getUsos();
  if (!usos[normalizada]) return false;

  delete usos[normalizada];
  saveUsos(usos);
  return true;
}

/**
 * Remove os registros de uso das matrículas informadas (usado ao excluí-las da base)
 * @param {Array<string>} matriculas
 */
function limparUsos(matriculas) {
  const usos = getUsos();
  let alterou = false;

  for (const m of matriculas) {
    const normalizada = String(m).trim();
    if (usos[normalizada]) {
      delete usos[normalizada];
      alterou = true;
    }
  }

  if (alterou) saveUsos(usos);
}

/**
 * Adiciona uma nova matrícula na base de dados
 * @param {string} matricula
 * @returns {boolean}
 */
export function adicionarMatricula(matricula) {
  const normalizada = String(matricula).trim();
  if (!normalizada) return false;

  const lista = getMatriculas();
  if (lista.includes(normalizada)) {
    return false; // Já existe
  }

  lista.push(normalizada);
  saveMatriculas(lista);
  return true;
}

/**
 * Adiciona um lote de matrículas (Importação CSV / Texto em Massa)
 * @param {Array<string>|string} rawData - Array de strings ou texto CSV/separado por vírgula ou quebra de linha
 * @returns {{ addedCount: number, totalMatriculas: number, matriculas: Array<string> }}
 */
export function adicionarMatriculasEmMassa(rawData) {
  let items = [];

  if (Array.isArray(rawData)) {
    items = rawData;
  } else if (typeof rawData === 'string') {
    // Separa por vírgulas, ponto e vírgula, quebras de linha ou espaços
    items = rawData.split(/[\n\r,;\s]+/);
  }

  const listaAtual = getMatriculas();
  const setAtual = new Set(listaAtual);
  let addedCount = 0;

  for (const item of items) {
    const limpo = String(item).replace(/["']/g, '').trim();
    if (limpo && !setAtual.has(limpo)) {
      setAtual.add(limpo);
      addedCount++;
    }
  }

  const novaLista = Array.from(setAtual);
  saveMatriculas(novaLista);

  return {
    addedCount,
    totalMatriculas: novaLista.length,
    matriculas: novaLista
  };
}

/**
 * Remove uma matrícula da base de dados
 * @param {string} matricula
 * @returns {boolean}
 */
export function removerMatricula(matricula) {
  const normalizada = String(matricula).trim();
  let lista = getMatriculas();
  const totalOriginal = lista.length;

  lista = lista.filter(m => m !== normalizada);

  if (lista.length === totalOriginal) {
    return false; // Não foi encontrada
  }

  saveMatriculas(lista);
  limparUsos([normalizada]);
  return true;
}

/**
 * Remove um lote de matrículas em massa
 * @param {Array<string>} itemsToRemove
 * @returns {{ removedCount: number, totalMatriculas: number, matriculas: Array<string> }}
 */
export function removerMatriculasEmMassa(itemsToRemove) {
  if (!Array.isArray(itemsToRemove) || itemsToRemove.length === 0) {
    const atual = getMatriculas();
    return { removedCount: 0, totalMatriculas: atual.length, matriculas: atual };
  }

  const setRemover = new Set(itemsToRemove.map(m => String(m).trim()));
  const listaAtual = getMatriculas();
  const totalOriginal = listaAtual.length;

  const novaLista = listaAtual.filter(m => !setRemover.has(String(m).trim()));
  const removedCount = totalOriginal - novaLista.length;

  saveMatriculas(novaLista);
  limparUsos(Array.from(setRemover));

  return {
    removedCount,
    totalMatriculas: novaLista.length,
    matriculas: novaLista
  };
}

/**
 * Salva a lista inteira de matrículas no JSON
 * @param {Array<string>} lista
 */
export function saveMatriculas(lista) {
  try {
    ensureFileExists();
    fs.writeFileSync(MATRICULAS_FILE, JSON.stringify(lista, null, 2), 'utf-8');
  } catch (err) {
    console.error('[databaseService] Erro ao salvar matrículas no disco:', err);
  }
}
