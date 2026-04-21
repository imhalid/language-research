export class MorphologyEngine {
  static lemmatize(word: string): string {
    const value = word.toLowerCase();

    if (value.endsWith('ies') && value.length > 3) return `${value.slice(0, -3)}y`;
    if (value.endsWith('ing') && value.length > 4) return value.slice(0, -3);
    if (value.endsWith('ed') && value.length > 3) return value.slice(0, -2);
    if (value.endsWith('es') && value.length > 3) return value.slice(0, -2);
    if (value.endsWith('s') && value.length > 3) return value.slice(0, -1);

    return value;
  }

  static getForms(lemma: string): string[] {
    return [lemma, `${lemma}s`, `${lemma}ed`, `${lemma}ing`];
  }

  static tokenize(text: string): string[] {
    return text.match(/[A-Za-z']+/g) ?? [];
  }

  static normalizeToken(token: string): string {
    return this.lemmatize(token.replace(/[^A-Za-z']/g, ''));
  }
}
