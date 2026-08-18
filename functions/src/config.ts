import { defineSecret } from "firebase-functions/params";
import type { CallableOptions } from "firebase-functions/v2/https";
import type { HttpsOptions } from "firebase-functions/v2/https";

/**
 * Chave da API da Anthropic. Guardada no Secret Manager — nunca no código,
 * nunca em variável do frontend. Configurar com:
 *   firebase functions:secrets:set ANTHROPIC_API_KEY
 */
export const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

/** São Paulo: mais perto dos usuários e dos dados. */
export const REGIAO = "southamerica-east1";

/**
 * Bucket do Storage onde ficam as atas originais.
 *
 * Normalmente `undefined` basta: o Admin SDK lê o bucket padrão de
 * `FIREBASE_CONFIG`, que o runtime das Functions preenche. A variável existe
 * como escape: projetos criados sob a nomenclatura nova (`<projeto>.firebasestorage.app`)
 * já apresentaram resolução automática para o nome antigo (`<projeto>.appspot.com`).
 * Se o log de `processarAta` acusar bucket inexistente, defina STORAGE_BUCKET.
 */
export const BUCKET_ATAS = process.env.STORAGE_BUCKET || undefined;

/** Origens liberadas para as callable/HTTP functions. */
const CORS_ORIGENS = true;

export const OPCOES_PADRAO: CallableOptions = {
  region: REGIAO,
  cors: CORS_ORIGENS,
  memory: "512MiB",
  timeoutSeconds: 120,
};

/**
 * Para as chamadas ao Claude: uma ata longa pode levar vários minutos de
 * extração, e o PDF em base64 ocupa memória.
 */
export const OPCOES_PESADAS: CallableOptions = {
  region: REGIAO,
  cors: CORS_ORIGENS,
  memory: "2GiB",
  timeoutSeconds: 540,
};

export const OPCOES_HTTP: HttpsOptions = {
  region: REGIAO,
  cors: CORS_ORIGENS,
  memory: "1GiB",
  timeoutSeconds: 300,
};
