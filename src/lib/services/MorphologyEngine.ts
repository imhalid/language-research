const IRREGULAR_LEMMAS: Record<string, string> = {
  am: 'be',
  are: 'be',
  been: 'be',
  better: 'good',
  best: 'good',
  did: 'do',
  done: 'do',
  had: 'have',
  has: 'have',
  is: 'be',
  men: 'man',
  mice: 'mouse',
  ran: 'run',
  saw: 'see',
  seen: 'see',
  was: 'be',
  went: 'go',
  were: 'be',
  women: 'woman',
  worse: 'bad',
  worst: 'bad'
};

const collapseDoubleConsonant = (value: string): string =>
  /([b-df-hj-np-tv-z])\1$/.test(value) ? value.slice(0, -1) : value;

const restoreSilentE = (value: string): string =>
  /(ak|at|bl|it|iv|op|ov|ur|us|yz)$/.test(value) ? `${value}e` : value;

const sanitizeToken = (value: string): string =>
  value
    .toLowerCase()
    .replace(/^'+|'+$/g, '')
    .replace(/[^a-z']/g, '');

export class MorphologyEngine {
  static lemmatize(word: string): string {
    const value = sanitizeToken(word);

    if (!value) return '';
    if (IRREGULAR_LEMMAS[value]) return IRREGULAR_LEMMAS[value];
    if (value.endsWith("'s") && value.length > 4) return this.lemmatize(value.slice(0, -2));
    if (value.endsWith('ies') && value.length > 4) return `${value.slice(0, -3)}y`;
    if (value.endsWith('ied') && value.length > 4) return `${value.slice(0, -3)}y`;

    if (value.endsWith('ing') && value.length > 5) {
      return restoreSilentE(collapseDoubleConsonant(value.slice(0, -3)));
    }

    if (value.endsWith('ed') && value.length > 4) {
      const stem = value.slice(0, -2);
      return stem.endsWith('i')
        ? `${stem.slice(0, -1)}y`
        : restoreSilentE(collapseDoubleConsonant(stem));
    }

    if (/(ches|shes|sses|xes|zes|oes)$/.test(value) && value.length > 4) {
      return value.slice(0, -2);
    }

    if (value.endsWith('s') && value.length > 3 && !value.endsWith('ss')) {
      return value.slice(0, -1);
    }

    return value;
  }

  static getForms(lemma: string): string[] {
    const base = sanitizeToken(lemma);

    if (!base) return [];

    const plural = base.endsWith('y') && !/[aeiou]y$/.test(base) ? `${base.slice(0, -1)}ies` : `${base}s`;
    const past = base.endsWith('e') ? `${base}d` : `${base}ed`;
    const progressive = base.endsWith('e') ? `${base.slice(0, -1)}ing` : `${base}ing`;

    return [...new Set([base, plural, past, progressive])];
  }

  static tokenize(text: string): string[] {
    return text.match(/[A-Za-z']+/g) ?? [];
  }

  static normalizeToken(token: string): string {
    return this.lemmatize(sanitizeToken(token));
  }
}
