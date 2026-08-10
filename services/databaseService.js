const fs = require('fs');
const path = require('path');

const MATRICULAS_FILE = path.join(__dirname, '../data/matriculas.json');

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
 * Retorna todas as matrículas cadastradas
 * @returns {Array<string>}
 */
function getMatriculas() {
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
 * Verifica se a matrícula existe na base de dados
 * @param {string} matricula 
 * @returns {boolean}
 */
function validarMatricula(matricula) {
  if (!matricula) return false;
  const lista = getMatriculas();
  const normalizada = String(matricula).trim();
  return lista.includes(normalizada);
}

/**
 * Adiciona uma nova matrícula na base de dados
 * @param {string} matricula 
 * @returns {boolean}
 */
function adicionarMatricula(matricula) {
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
function adicionarMatriculasEmMassa(rawData) {
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

  for (let item of items) {
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
function removerMatricula(matricula) {
  const normalizada = String(matricula).trim();
  let lista = getMatriculas();
  const totalOriginal = lista.length;

  lista = lista.filter(m => m !== normalizada);

  if (lista.length === totalOriginal) {
    return false; // Não foi encontrada
  }

  saveMatriculas(lista);
  return true;
}

/**
 * Remove um lote de matrículas em massa
 * @param {Array<string>} itemsToRemove 
 * @returns {{ removedCount: number, totalMatriculas: number, matriculas: Array<string> }}
 */
function removerMatriculasEmMassa(itemsToRemove) {
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
function saveMatriculas(lista) {
  try {
    ensureFileExists();
    fs.writeFileSync(MATRICULAS_FILE, JSON.stringify(lista, null, 2), 'utf-8');
  } catch (err) {
    console.error('[databaseService] Erro ao salvar matrículas no disco:', err);
  }
}

module.exports = {
  getMatriculas,
  validarMatricula,
  adicionarMatricula,
  adicionarMatriculasEmMassa,
  removerMatricula,
  removerMatriculasEmMassa,
  saveMatriculas
};
