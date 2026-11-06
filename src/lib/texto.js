// Funções de texto: busca tolerante a erro de grafia, máscara de documento,
// datas e leitura da chave de nota fiscal.

export function normalizar(s = '') {
  return String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Distância de edição simples (Levenshtein) para tolerar erros de digitação.
function distancia(a, b) {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let ant = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const atual = [i];
    for (let j = 1; j <= n; j++) {
      atual[j] = Math.min(
        ant[j] + 1,
        atual[j - 1] + 1,
        ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    ant = atual;
  }
  return ant[n];
}

// Pontua uma pessoa contra o termo digitado. Quanto menor, melhor; null = não serve.
export function pontuarPessoa(pessoa, termo) {
  const t = normalizar(termo);
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    return String(pessoa.numeroCadete || '').startsWith(t) ? 0 : null;
  }
  const palavras = normalizar(`${pessoa.nomeGuerra} ${pessoa.nomeCompleto}`).split(' ');
  let melhor = null;
  for (const termoParte of t.split(' ')) {
    let melhorParte = null;
    for (const p of palavras) {
      let pontos = null;
      if (p.startsWith(termoParte)) pontos = 0;
      else {
        const prefixo = p.slice(0, termoParte.length);
        const d = distancia(termoParte, prefixo);
        const tolerancia = termoParte.length >= 5 ? 2 : termoParte.length >= 3 ? 1 : 0;
        if (d <= tolerancia) pontos = d;
      }
      if (pontos !== null && (melhorParte === null || pontos < melhorParte)) melhorParte = pontos;
    }
    if (melhorParte === null) return null;
    melhor = (melhor ?? 0) + melhorParte;
  }
  // Nome de guerra que começa com o termo vem primeiro.
  if (normalizar(pessoa.nomeGuerra).startsWith(t)) melhor -= 0.5;
  return melhor;
}

export function buscarPessoas(pessoas, termo, limite = 8) {
  return pessoas
    .filter((p) => p.perfil !== 'guarda')
    .map((p) => ({ p, s: pontuarPessoa(p, termo) }))
    .filter((x) => x.s !== null)
    .sort((a, b) => a.s - b.s)
    .slice(0, limite)
    .map((x) => x.p);
}

export function tratamento(pessoa) {
  if (!pessoa) return '';
  return `Cad. ${pessoa.nomeGuerra}`;
}

export function descricaoPessoa(pessoa) {
  if (!pessoa) return '';
  return [pessoa.setor, pessoa.turma, pessoa.pelotao && `Pel. ${pessoa.pelotao}`]
    .filter(Boolean)
    .join(' · ');
}

// Documento do entregador exibido mascarado (LGPD): só os 5 últimos caracteres.
export function mascararDocumento(doc = '') {
  const limpo = String(doc).replace(/\s/g, '');
  if (!limpo) return '';
  const visivel = limpo.slice(-5);
  return `${'•'.repeat(Math.max(limpo.length - 5, 3))}${visivel}`;
}

// Chave de acesso da NF-e/NFC-e: 44 dígitos; o número da nota fica nas
// posições 26 a 34 (9 dígitos).
export function numeroDaChaveNF(codigo = '') {
  const digitos = String(codigo).replace(/\D/g, '');
  if (digitos.length !== 44) return null;
  return String(Number(digitos.slice(25, 34)));
}

// Identifica o que foi lido pela câmera.
export function interpretarCodigo(codigo = '') {
  const bruto = String(codigo).trim();
  const nf = numeroDaChaveNF(bruto);
  if (nf) return { tipo: 'nf', numero: nf, chave: bruto.replace(/\D/g, '') };
  // Padrão internacional dos Correios: 2 letras, 9 dígitos, 2 letras.
  if (/^[A-Z]{2}\d{9}[A-Z]{2}$/i.test(bruto)) return { tipo: 'rastreio', numero: bruto.toUpperCase() };
  return { tipo: 'rastreio', numero: bruto };
}

const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function paraData(valor) {
  if (!valor) return null;
  if (valor.toDate) return valor.toDate();
  return new Date(valor);
}

export function hora(valor) {
  const d = paraData(valor);
  return d ? fmtHora.format(d).replace(':', 'h') : '';
}

export function dataHora(valor) {
  const d = paraData(valor);
  if (!d) return '';
  return `${fmtData.format(d)}, ${hora(d)}`;
}

export function quando(valor) {
  const d = paraData(valor);
  if (!d) return '';
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (d.toDateString() === hoje.toDateString()) return `hoje, ${hora(d)}`;
  if (d.toDateString() === ontem.toDateString()) return `ontem, ${hora(d)}`;
  return fmtData.format(d);
}

export function diasDesde(valor) {
  const d = paraData(valor);
  if (!d) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

export function linkWhatsApp(mensagem, celular) {
  const texto = encodeURIComponent(mensagem);
  if (celular) {
    let numero = String(celular).replace(/\D/g, '');
    if (numero.length <= 11) numero = `55${numero}`;
    return `https://wa.me/${numero}?text=${texto}`;
  }
  return `https://wa.me/?text=${texto}`;
}
