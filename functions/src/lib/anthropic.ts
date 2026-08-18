import Anthropic from "@anthropic-ai/sdk";

/**
 * Modelo usado em todas as chamadas. Extração de atas de engenharia envolve
 * texto denso, tabelas e croquis — vale o modelo mais capaz disponível.
 */
export const MODELO = "claude-opus-5";

let cliente: Anthropic | undefined;

/**
 * Cliente Anthropic preguiçoso: só é construído na primeira chamada, para que
 * o carregamento do módulo não falhe quando a secret ainda não foi resolvida
 * (deploy, análise estática do firebase-functions, testes).
 */
export function getAnthropic(): Anthropic {
  if (!cliente) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY não configurada. Rode: firebase functions:secrets:set ANTHROPIC_API_KEY",
      );
    }
    cliente = new Anthropic({ apiKey });
  }
  return cliente;
}
