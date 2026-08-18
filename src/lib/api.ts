"use client";

import { httpsCallable } from "firebase/functions";
import { ref, uploadBytes } from "firebase/storage";
import { functions, storage, urlFunctionHttp } from "./firebase";
import { TipoFonte } from "./domain";

export interface RespostaProcessarAta {
  reuniaoId: string;
  totalTemas: number;
  dataReuniao: string;
  tipoFonte: TipoFonte;
}

export interface RespostaRecorrencia {
  comparados: number;
  vinculosCriados: number;
  disciplinas: string[];
}

/**
 * Sobe o arquivo original para o Storage e devolve o caminho.
 *
 * O upload é direto do navegador (e não em base64 dentro da chamada da
 * function) porque as atas manuais em DOCX passam facilmente do limite de
 * payload das callable functions por causa dos screenshots incorporados.
 */
export async function enviarArquivo(
  empreendimentoId: string,
  arquivo: File,
): Promise<string> {
  const seguro = arquivo.name.replace(/[^\w.\-]+/g, "_");
  const caminho = `atas/${empreendimentoId}/${Date.now()}-${seguro}`;
  await uploadBytes(ref(storage(), caminho), arquivo, {
    contentType: arquivo.type || "application/octet-stream",
  });
  return caminho;
}

export async function processarAta(entrada: {
  empreendimentoId: string;
  storagePath?: string;
  nomeArquivo?: string;
  texto?: string;
  dataReuniao?: string;
}): Promise<RespostaProcessarAta> {
  const fn = httpsCallable<typeof entrada, RespostaProcessarAta>(
    functions(),
    "processarAta",
  );
  const resposta = await fn(entrada);
  return resposta.data;
}

export async function detectarRecorrencia(
  reuniaoId?: string,
): Promise<RespostaRecorrencia> {
  const fn = httpsCallable<{ reuniaoId?: string }, RespostaRecorrencia>(
    functions(),
    "detectarRecorrencia",
  );
  const resposta = await fn({ reuniaoId });
  return resposta.data;
}

/** URL de download do .xlsx; sem `empreendimentoId`, exporta tudo. */
export function urlExportarExcel(empreendimentoId?: string): string {
  const base = urlFunctionHttp("exportarExcel");
  return empreendimentoId
    ? `${base}?empreendimentoId=${encodeURIComponent(empreendimentoId)}`
    : base;
}

/** Mensagem de erro legível a partir de um erro de callable function. */
/**
 * Erros do Storage que só o SDK sabe nomear, traduzidos para o que a pessoa
 * precisa fazer. `retry-limit-exceeded` é o mais traiçoeiro: o SDK insiste
 * mesmo em falhas permanentes, então ele quase sempre significa que o bucket
 * não existe ou que as regras não foram publicadas — não instabilidade de rede.
 */
const MENSAGENS_STORAGE: Record<string, string> = {
  "storage/retry-limit-exceeded":
    "O envio não completou. Normalmente isso significa que o Firebase Storage " +
    "ainda não foi ativado no projeto, ou que as regras de Storage não foram " +
    "publicadas. Confira no Console do Firebase, em Build → Storage.",
  "storage/unauthorized":
    "O Storage recusou o envio. Publique as regras de Storage " +
    "(firebase deploy --only storage) e tente novamente.",
  "storage/unknown":
    "O envio falhou sem resposta do servidor. Verifique se o Firebase Storage " +
    "está ativado no projeto e se o bucket em NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET " +
    "confere com o que aparece no Console.",
  "storage/quota-exceeded":
    "A cota de armazenamento do projeto foi excedida.",
  "storage/canceled": "Envio cancelado.",
};

export function mensagemDeErro(erro: unknown): string {
  if (erro && typeof erro === "object") {
    const codigo = (erro as { code?: unknown }).code;
    if (typeof codigo === "string" && MENSAGENS_STORAGE[codigo]) {
      return MENSAGENS_STORAGE[codigo];
    }
    if ("message" in erro) {
      const m = String((erro as { message: unknown }).message);
      // O SDK prefixa erros de callable com "FirebaseError: ".
      return m.replace(/^FirebaseError:\s*/, "");
    }
  }
  return "Erro inesperado.";
}
