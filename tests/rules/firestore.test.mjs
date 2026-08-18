/**
 * Verifica firestore.rules contra o emulador: o que o navegador pode e não pode.
 *
 * Rode com `npm run test:rules`, que sobe os emuladores automaticamente.
 */
import { initializeApp } from "firebase/app";
import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  setDoc,
  updateDoc,
} from "firebase/firestore";

const app = initializeApp({ projectId: "mrvbraga", apiKey: "fake" });
const db = getFirestore(app);
connectFirestoreEmulator(db, "127.0.0.1", 8080);

let falhas = 0;

/** Executa `fn` e confere se ela foi permitida ou negada, como esperado. */
async function espera(permitido, rotulo, fn) {
  let ok;
  let detalhe = "";
  try {
    await fn();
    ok = true;
  } catch (e) {
    ok = false;
    detalhe = e.code ?? String(e.message).slice(0, 60);
  }
  const passou = ok === permitido;
  if (!passou) falhas += 1;
  const esperado = permitido ? "PERMITIDO" : "NEGADO";
  console.log(
    `${passou ? "✓" : "✗"} ${esperado.padEnd(9)} ${rotulo}` +
      (ok || permitido ? "" : ` (${detalhe})`),
  );
}

console.log("— empreendimentos: o navegador cria, com validação —");
await espera(true, "ler a lista", () => getDocs(collection(db, "empreendimentos")));
await espera(true, "criar com nome válido", () =>
  addDoc(collection(db, "empreendimentos"), {
    nome: "Spazio Jequitibá",
    localizacao: "Contagem/MG",
  }),
);
await espera(false, "criar sem nome", () =>
  addDoc(collection(db, "empreendimentos"), { localizacao: "Contagem/MG" }),
);
await espera(false, "criar com nome vazio", () =>
  addDoc(collection(db, "empreendimentos"), { nome: "" }),
);
await espera(false, "criar com nome de 300 caracteres", () =>
  addDoc(collection(db, "empreendimentos"), { nome: "x".repeat(300) }),
);
await espera(false, "criar com nome numérico", () =>
  addDoc(collection(db, "empreendimentos"), { nome: 42 }),
);

console.log("\n— temas: só as Cloud Functions escrevem —");
await espera(true, "ler temas", () => getDocs(collection(db, "temas")));
await espera(false, "criar tema", () =>
  addDoc(collection(db, "temas"), { tema: "invasor", disciplina: "Esgoto" }),
);
await espera(false, "alterar tema", () =>
  updateDoc(doc(db, "temas", "qualquer"), { status: "Resolvido" }),
);

console.log("\n— reuniões: só as Cloud Functions escrevem —");
await espera(true, "ler reunião", () =>
  getDoc(doc(db, "empreendimentos", "e1", "reunioes", "r1")),
);
await espera(false, "criar reunião", () =>
  setDoc(doc(db, "empreendimentos", "e1", "reunioes", "r1"), {
    data: "01/01/2025",
  }),
);

console.log("\n— coleções fora do modelo de dados —");
await espera(false, "ler coleção arbitrária", () =>
  getDocs(collection(db, "qualquer_outra")),
);
await espera(false, "escrever em coleção arbitrária", () =>
  addDoc(collection(db, "qualquer_outra"), { x: 1 }),
);

console.log(
  `\n${falhas === 0 ? "firestore.rules: OK" : `firestore.rules: ${falhas} regra(s) fora do esperado`}`,
);
process.exit(falhas === 0 ? 0 : 1);
