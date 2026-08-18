/**
 * Tipos e constantes do domínio.
 *
 * Mantido em sincronia manual com `functions/src/domain.ts` — as duas cópias
 * existem porque `functions/` é um pacote npm separado. Alterou aqui, altere lá.
 */

export const DISCIPLINAS = [
  "Água Fria",
  "Esgoto",
  "Drenagem",
  "Elétrico",
  "Comunicações",
  "Aterramento",
  "Incêndio",
  "Entrada de Energia",
  "Iluminação",
  "Outro",
] as const;

export type Disciplina = (typeof DISCIPLINAS)[number];

export const STATUS_TEMA = ["Resolvido", "Em andamento", "Pendente"] as const;

export type StatusTema = (typeof STATUS_TEMA)[number];

export type TipoFonte = "forma" | "manual" | "texto_colado";

export type StatusReuniao = "processando" | "concluido" | "erro";

export const NAO_INFORMADO = "-";

export interface Tema {
  id: string;
  empreendimentoId: string;
  empreendimentoNome: string;
  reuniaoId: string;
  dataReuniao: string;
  disciplina: Disciplina;
  tema: string;
  contexto: string;
  solucao: string;
  responsavel: string;
  prazo: string;
  status: StatusTema;
  temaRecorrenteDe: string[];
}

export interface Empreendimento {
  id: string;
  nome: string;
  localizacao: string;
  createdAt: number | null;
}

export interface Reuniao {
  id: string;
  data: string;
  tipoFonte: TipoFonte;
  arquivoOriginalUrl: string | null;
  nomeArquivoOriginal: string | null;
  status: StatusReuniao;
  erro: string | null;
  totalTemas: number;
  processadoEm: number | null;
}

/** Rótulo legível para a origem da ata. */
export const ROTULO_FONTE: Record<TipoFonte, string> = {
  forma: "Autodesk Forma",
  manual: "Ata manual",
  texto_colado: "Texto colado",
};

/**
 * Classes por status. Mesmo código de cores da planilha que o time já usava:
 * verde = Resolvido, amarelo = Em andamento, vermelho = Pendente.
 */
export const CLASSE_STATUS: Record<StatusTema, string> = {
  Resolvido: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  "Em andamento": "bg-amber-50 text-amber-700 ring-amber-600/20",
  Pendente: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

/** Cor sólida por status, para os gráficos. */
export const COR_STATUS: Record<StatusTema, string> = {
  Resolvido: "#059669",
  "Em andamento": "#d97706",
  Pendente: "#e11d48",
};

/** Paleta das disciplinas nos gráficos, na ordem de `DISCIPLINAS`. */
export const CORES_DISCIPLINA = [
  "#0ea5e9", "#8b5cf6", "#14b8a6", "#f59e0b", "#ec4899",
  "#84cc16", "#ef4444", "#6366f1", "#f97316", "#64748b",
] as const;

export function corDaDisciplina(disciplina: Disciplina): string {
  const indice = DISCIPLINAS.indexOf(disciplina);
  return CORES_DISCIPLINA[indice >= 0 ? indice : CORES_DISCIPLINA.length - 1];
}
