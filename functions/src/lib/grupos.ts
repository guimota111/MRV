/**
 * Agrupamento de temas recorrentes.
 *
 * `temaRecorrenteDe` guarda vínculos par a par. Para exibir "grupos de temas
 * recorrentes" (no dashboard e na aba do Excel) é preciso fechar a transitividade:
 * se A↔B e B↔C, os três são o mesmo assunto recorrente. Union-find resolve isso.
 *
 * Mantido em sincronia com `src/lib/grupos.ts` do frontend, que usa a mesma
 * lógica para renderizar a seção "Temas Recorrentes".
 */

export interface ItemAgrupavel {
  id: string;
  temaRecorrenteDe?: string[];
}

/**
 * Devolve os grupos com 2+ integrantes, na ordem em que aparecem em `itens`.
 * Vínculos que apontam para IDs ausentes da lista são ignorados — pode
 * acontecer se um tema foi excluído depois de vinculado.
 */
export function agruparRecorrentes<T extends ItemAgrupavel>(itens: T[]): T[][] {
  const porId = new Map<string, T>();
  for (const item of itens) porId.set(item.id, item);

  const pai = new Map<string, string>();
  const raiz = (id: string): string => {
    let atual = id;
    while (pai.get(atual) !== undefined && pai.get(atual) !== atual) {
      const acima = pai.get(atual) as string;
      // Compressão de caminho.
      pai.set(atual, pai.get(acima) ?? acima);
      atual = pai.get(atual) as string;
    }
    return atual;
  };
  const unir = (a: string, b: string) => {
    const ra = raiz(a);
    const rb = raiz(b);
    if (ra !== rb) pai.set(ra, rb);
  };

  for (const item of itens) pai.set(item.id, item.id);
  for (const item of itens) {
    for (const outro of item.temaRecorrenteDe ?? []) {
      if (porId.has(outro)) unir(item.id, outro);
    }
  }

  const grupos = new Map<string, T[]>();
  for (const item of itens) {
    const r = raiz(item.id);
    const grupo = grupos.get(r);
    if (grupo) grupo.push(item);
    else grupos.set(r, [item]);
  }

  return [...grupos.values()].filter((g) => g.length > 1);
}
