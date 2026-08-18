/**
 * Verifica storage.rules contra o emulador.
 *
 * Rode com `npm run test:rules`, que sobe os emuladores automaticamente.
 *
 * O limite de 64 MB não é exercitado aqui: enviar um arquivo desse tamanho ao
 * emulador tornaria o teste lento demais para o retorno que dá.
 */
import { initializeApp } from "firebase/app";
import {
  connectStorageEmulator,
  deleteObject,
  getBytes,
  getStorage,
  ref,
  uploadBytes,
} from "firebase/storage";

const app = initializeApp({
  projectId: "mrvbraga",
  storageBucket: "mrvbraga.firebasestorage.app",
  apiKey: "fake",
});
const st = getStorage(app);
connectStorageEmulator(st, "127.0.0.1", 9199);

/** Cabeçalho de um PDF — o conteúdo não importa, só o content-type. */
const CONTEUDO = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);
const DOCX =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

let falhas = 0;

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

console.log("— upload de atas —");
await espera(true, "PDF em atas/{obra}/", () =>
  uploadBytes(ref(st, "atas/e1/ata.pdf"), CONTEUDO, {
    contentType: "application/pdf",
  }),
);
await espera(true, "DOCX em atas/{obra}/", () =>
  uploadBytes(ref(st, "atas/e1/ata.docx"), CONTEUDO, { contentType: DOCX }),
);
await espera(true, "octet-stream (navegador que não preenche o tipo)", () =>
  uploadBytes(ref(st, "atas/e1/ata2.pdf"), CONTEUDO, {
    contentType: "application/octet-stream",
  }),
);
await espera(false, "texto puro", () =>
  uploadBytes(ref(st, "atas/e1/ata.txt"), CONTEUDO, { contentType: "text/plain" }),
);
await espera(false, "imagem", () =>
  uploadBytes(ref(st, "atas/e1/foto.png"), CONTEUDO, { contentType: "image/png" }),
);

console.log("\n— leitura e remoção —");
await espera(true, "ler ata enviada", () => getBytes(ref(st, "atas/e1/ata.pdf")));
await espera(false, "apagar ata", () => deleteObject(ref(st, "atas/e1/ata.pdf")));

console.log("\n— fora de atas/ —");
await espera(false, "upload na raiz", () =>
  uploadBytes(ref(st, "solto.pdf"), CONTEUDO, { contentType: "application/pdf" }),
);
await espera(false, "upload em outro prefixo", () =>
  uploadBytes(ref(st, "outros/x/a.pdf"), CONTEUDO, {
    contentType: "application/pdf",
  }),
);

console.log(
  `\n${falhas === 0 ? "storage.rules: OK" : `storage.rules: ${falhas} regra(s) fora do esperado`}`,
);
process.exit(falhas === 0 ? 0 : 1);
