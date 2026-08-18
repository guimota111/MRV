/**
 * Cloud Functions da ferramenta de consolidação de briefings.
 *
 * Toda chamada à API da Anthropic acontece aqui — a chave vive no Secret
 * Manager e nunca é exposta ao frontend.
 */
export { processarAta } from "./handlers/processarAta";
export { detectarRecorrencia } from "./handlers/detectarRecorrencia";
export { exportarExcel } from "./handlers/exportarExcel";
