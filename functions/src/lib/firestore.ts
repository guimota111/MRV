import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

if (getApps().length === 0) {
  initializeApp();
}

export const db = getFirestore();
export const storage = getStorage();

export const COL_EMPREENDIMENTOS = "empreendimentos";
export const COL_REUNIOES = "reunioes";
export const COL_TEMAS = "temas";

/** Firestore aceita no máximo 500 operações por batch. */
export const LIMITE_BATCH = 500;

/** Divide uma lista em blocos de tamanho `n`. */
export function emBlocos<T>(itens: T[], n: number): T[][] {
  const blocos: T[][] = [];
  for (let i = 0; i < itens.length; i += n) blocos.push(itens.slice(i, i + n));
  return blocos;
}
