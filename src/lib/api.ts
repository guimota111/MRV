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

/**
 * Erros que só o SDK sabe nomear, traduzidos para o que a pessoa precisa
 * fazer. `retry-limit-exceeded` é o mais traiçoeiro: o SDK insiste
 * mesmo em falhas permanentes, então ele quase sempre significa que o bucket
 * não existe ou que as regras não foram publicadas — não instabilidade de rede.
 */
const MENSAGENS_POR_CODIGO: Record<string, string> = {
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
  "storage/quota-exceeded": "A cota de armazenamento do projeto foi excedida.",
  "storage/canceled": "Envio cancelado.",

  // As functions repassam a causa real via HttpsError, e essa mensagem é
  // preferida quando existe. `functions/internal` sem mensagem própria é o
  // caso em que o SDK não conseguiu sequer interpretar a resposta — na
  // prática, a function não está publicada e o que voltou foi um 404.
  "functions/internal":
    "O backend não respondeu como esperado. Verifique se as Cloud Functions " +
    "foram publicadas (firebase deploy --only functions).",
  "functions/not-found":
    "A função chamada não existe neste projeto. Publique o backend com " +
    "firebase deploy --only functions.",
  "functions/deadline-exceeded":
    "O processamento passou do tempo limite. Atas muito longas podem precisar " +
    "ser divididas em partes menores.",
  "functions/unavailable":
    "O backend está indisponível no momento. Tente novamente em alguns instantes.",
};

/**
 * Diz se a mensagem do erro veio das nossas Cloud Functions.
 *
 * Só vale para códigos `functions/*`: ali a mensagem é a que o `HttpsError`
 * mandou e descreve a causa concreta ("PDF de 45 MB excede o limite"), então
 * ganha do texto genérico. Erros de `storage/*` trazem boilerplate do próprio
 * SDK, que não explica nada — para esses, a tradução acima é sempre melhor.
 */
function temMensagemDaFunction(erro: object): boolean {
  const codigo = String((erro as { code?: unknown }).code ?? "");
  if (!codigo.startsWith("functions/")) return false;

  const m = (erro as { message?: unknown }).message;
  if (typeof m !== "string") return false;

  const limpo = m.replace(/^FirebaseError:\s*/, "").trim();
  // Sem mensagem de verdade, o SDK repete o próprio código no lugar dela.
  return limpo !== "" && limpo !== codigo && limpo !== codigo.split("/").pop();
}

export function mensagemDeErro(erro: unknown): string {
  if (erro && typeof erro === "object") {
    const codigo = (erro as { code?: unknown }).code;

    // A mensagem que a própria function mandou é sempre a mais específica —
    // ela sabe se o PDF passou do limite, se nenhum tema foi encontrado, etc.
    if (temMensagemDaFunction(erro)) {
      const m = String((erro as { message: unknown }).message);
      // O SDK prefixa erros de callable com "FirebaseError: ".
      return m.replace(/^FirebaseError:\s*/, "");
    }

    if (typeof codigo === "string" && MENSAGENS_POR_CODIGO[codigo]) {
      return MENSAGENS_POR_CODIGO[codigo];
    }

    if ("message" in erro) {
      const m = String((erro as { message: unknown }).message);
      return m.replace(/^FirebaseError:\s*/, "");
    }
  }
  return "Erro inesperado.";
}
