/**
 * Fichas coladas de uma lista: uma por linha, "pergunta; resposta".
 * Aceita também TAB (copiar duas colunas de uma planilha) e "|". Com TAB na
 * linha, ele separa (o texto da planilha pode ter ";"); sem TAB, vale o primeiro
 * ";" ou "|" da linha. O resto fica na resposta. Linhas sem as duas partes são
 * contadas como ignoradas.
 * @param {string} texto
 * @returns {{ fichas: { question: string, answer: string }[], ignoradas: number }}
 */
export function colarFichas(texto) {
  const fichas = [];
  let ignoradas = 0;
  for (const linha of texto.split(/\r?\n/)) {
    if (!linha.trim()) continue;
    const posicao = linha.includes("\t")
      ? linha.indexOf("\t")
      : Math.min(...[";", "|"].map((s) => linha.indexOf(s)).filter((i) => i >= 0), Infinity);
    const achou = Number.isFinite(posicao);
    const question = achou ? linha.slice(0, posicao).trim() : "";
    const answer = achou ? linha.slice(posicao + 1).trim() : "";
    if (question && answer) fichas.push({ question, answer });
    else ignoradas++;
  }
  return { fichas, ignoradas };
}
