import { Disciplina, StatusTema, Tema } from "./domain";

export interface Filtros {
  empreendimentoIds: string[];
  disciplinas: Disciplina[];
  status: StatusTema[];
  /** Reuniões selecionadas; vazio = todas. */
  reuniaoIds: string[];
  /** Data inicial/final no formato AAAA-MM-DD (o que `<input type="date">` usa). */
  dataDe: string;
  dataAte: string;
  busca: string;
  /** Quando true, mostra só temas que fazem parte de algum grupo recorrente. */
  somenteRecorrentes: boolean;
}

export const FILTROS_VAZIOS: Filtros = {
  empreendimentoIds: [],
  disciplinas: [],
  status: [],
  reuniaoIds: [],
  dataDe: "",
  dataAte: "",
  busca: "",
  somenteRecorrentes: false,
};

/** DD/MM/AAAA → AAAA-MM-DD. Devolve "" quando a data não é reconhecida. */
export function paraIso(data: string): string {
  const m = data?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

/** Chave de ordenação: datas inválidas vão para o fim. */
export function chaveData(data: string): string {
  return paraIso(data) || "9999-99-99";
}

function achatar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Aplica todos os filtros. A busca livre é acento-insensível e cobre tema,
 * contexto, solução, responsável e o nome do empreendimento.
 */
export function aplicarFiltros(temas: Tema[], filtros: Filtros): Tema[] {
  const termo = achatar(filtros.busca.trim());
  const termos = termo ? termo.split(/\s+/) : [];

  return temas.filter((t) => {
    if (
      filtros.empreendimentoIds.length > 0 &&
      !filtros.empreendimentoIds.includes(t.empreendimentoId)
    ) {
      return false;
    }
    if (
      filtros.disciplinas.length > 0 &&
      !filtros.disciplinas.includes(t.disciplina)
    ) {
      return false;
    }
    if (filtros.status.length > 0 && !filtros.status.includes(t.status)) {
      return false;
    }
    if (
      filtros.reuniaoIds.length > 0 &&
      !filtros.reuniaoIds.includes(t.reuniaoId)
    ) {
      return false;
    }
    if (filtros.somenteRecorrentes && (t.temaRecorrenteDe?.length ?? 0) === 0) {
      return false;
    }

    if (filtros.dataDe || filtros.dataAte) {
      const iso = paraIso(t.dataReuniao);
      // Tema sem data reconhecível não passa por um filtro de intervalo.
      if (!iso) return false;
      if (filtros.dataDe && iso < filtros.dataDe) return false;
      if (filtros.dataAte && iso > filtros.dataAte) return false;
    }

    if (termos.length > 0) {
      const alvo = achatar(
        [t.tema, t.contexto, t.solucao, t.responsavel, t.empreendimentoNome, t.disciplina].join(" "),
      );
      // Todos os termos precisam aparecer, em qualquer ordem.
      if (!termos.every((p) => alvo.includes(p))) return false;
    }

    return true;
  });
}

export function filtrosAtivos(filtros: Filtros): number {
  return (
    filtros.empreendimentoIds.length +
    filtros.disciplinas.length +
    filtros.status.length +
    filtros.reuniaoIds.length +
    (filtros.dataDe ? 1 : 0) +
    (filtros.dataAte ? 1 : 0) +
    (filtros.busca.trim() ? 1 : 0) +
    (filtros.somenteRecorrentes ? 1 : 0)
  );
}

/** Contagem por chave, preservando a ordem de `ordem`. */
export function contarPor<K extends string>(
  temas: Tema[],
  chave: (t: Tema) => K,
  ordem: readonly K[],
): { nome: K; total: number }[] {
  const contagem = new Map<K, number>();
  for (const t of temas) {
    const k = chave(t);
    contagem.set(k, (contagem.get(k) ?? 0) + 1);
  }
  return ordem
    .map((nome) => ({ nome, total: contagem.get(nome) ?? 0 }))
    .filter((linha) => linha.total > 0);
}

/** Ordena por empreendimento, depois data (mais recente primeiro), depois disciplina. */
export function ordenarTemas(temas: Tema[]): Tema[] {
  return [...temas].sort((a, b) => {
    const porNome = a.empreendimentoNome.localeCompare(b.empreendimentoNome, "pt-BR");
    if (porNome !== 0) return porNome;
    const porData = chaveData(b.dataReuniao).localeCompare(chaveData(a.dataReuniao));
    if (porData !== 0) return porData;
    return a.disciplina.localeCompare(b.disciplina, "pt-BR");
  });
}
