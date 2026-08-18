/**
 * Tipos e constantes do domínio, compartilhados por todas as functions.
 *
 * Este arquivo é mantido em sincronia manual com `src/lib/domain.ts` do frontend.
 * As duas cópias existem porque `functions/` é um pacote npm separado (build e
 * runtime próprios) — qualquer alteração aqui precisa ser refletida lá.
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

/** Valor usado quando o documento não menciona responsável/prazo. */
export const NAO_INFORMADO = "-";

/** Um tema tal como retornado pela extração do Claude (ainda sem IDs). */
export interface TemaExtraido {
  disciplina: Disciplina;
  tema: string;
  contexto: string;
  solucao: string;
  responsavel: string;
  prazo: string;
  status: StatusTema;
}

export interface ResultadoExtracao {
  dataReuniao?: string;
  temas: TemaExtraido[];
}

/** Documento da coleção raiz `temas/`. */
export interface Tema extends TemaExtraido {
  id: string;
  empreendimentoId: string;
  empreendimentoNome: string;
  reuniaoId: string;
  dataReuniao: string;
  temaRecorrenteDe: string[];
}

export interface Empreendimento {
  id: string;
  nome: string;
  localizacao?: string;
}

export interface Reuniao {
  id: string;
  data: string;
  tipoFonte: TipoFonte;
  arquivoOriginalUrl?: string;
  nomeArquivoOriginal?: string;
  status: StatusReuniao;
  erro?: string;
  totalTemas?: number;
}

export function isDisciplina(v: unknown): v is Disciplina {
  return typeof v === "string" && (DISCIPLINAS as readonly string[]).includes(v);
}

export function isStatusTema(v: unknown): v is StatusTema {
  return typeof v === "string" && (STATUS_TEMA as readonly string[]).includes(v);
}
