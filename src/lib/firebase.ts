"use client";

import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Firestore, getFirestore } from "firebase/firestore";
import { FirebaseStorage, getStorage } from "firebase/storage";
import { Functions, getFunctions } from "firebase/functions";

/** Precisa bater com `REGIAO` em `functions/src/config.ts`. */
export const REGIAO_FUNCTIONS = "southamerica-east1";

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/** True quando as variáveis mínimas de configuração estão presentes. */
export function firebaseConfigurado(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

/**
 * Inicialização preguiçosa. O build do Next.js roda sem as variáveis de
 * ambiente do Firebase; inicializar no topo do módulo quebraria o build e o
 * pré-render. Todo consumidor chama estas funções dentro de um efeito.
 */
function app(): FirebaseApp {
  if (!firebaseConfigurado()) {
    throw new Error(
      "Firebase não configurado. Preencha as variáveis NEXT_PUBLIC_FIREBASE_* no .env.local (veja .env.example).",
    );
  }
  return getApps().length > 0 ? getApp() : initializeApp(config);
}

export function db(): Firestore {
  return getFirestore(app());
}

export function storage(): FirebaseStorage {
  return getStorage(app());
}

export function functions(): Functions {
  return getFunctions(app(), REGIAO_FUNCTIONS);
}

/**
 * URL base das functions HTTP (usada pelo botão de exportar, que precisa de um
 * link direto para o navegador baixar o arquivo).
 */
export function urlFunctionHttp(nome: string): string {
  const base = process.env.NEXT_PUBLIC_FUNCTIONS_BASE_URL;
  if (base) return `${base.replace(/\/$/, "")}/${nome}`;
  return `https://${REGIAO_FUNCTIONS}-${config.projectId}.cloudfunctions.net/${nome}`;
}
