import assert from "node:assert/strict";
import { test } from "node:test";
import {
  casarDisciplina,
  casarStatus,
  normalizarData,
  normalizarTemas,
} from "./extracao";

test("normalizarData aceita os formatos que aparecem nas atas", () => {
  assert.equal(normalizarData("14/03/2025"), "14/03/2025");
  assert.equal(normalizarData("4/3/2025"), "04/03/2025");
  assert.equal(normalizarData("14-03-2025"), "14/03/2025");
  assert.equal(normalizarData("14/03/25"), "14/03/2025");
  assert.equal(normalizarData("2025-03-14"), "14/03/2025");
});

test("normalizarData devolve vazio para o que não reconhece", () => {
  assert.equal(normalizarData("22 de maio de 2025"), "");
  assert.equal(normalizarData(""), "");
  assert.equal(normalizarData(undefined), "");
  assert.equal(normalizarData(42), "");
});

test("casarDisciplina tolera acento e caixa diferentes", () => {
  assert.equal(casarDisciplina("Água Fria"), "Água Fria");
  assert.equal(casarDisciplina("Água fria"), "Água Fria");
  assert.equal(casarDisciplina("AGUA FRIA"), "Água Fria");
  assert.equal(casarDisciplina("entrada de energia"), "Entrada de Energia");
});

test("casarDisciplina cai em Outro quando não reconhece", () => {
  assert.equal(casarDisciplina("Paisagismo"), "Outro");
  assert.equal(casarDisciplina(undefined), "Outro");
});

test("casarStatus traduz os rótulos crus do Forma", () => {
  assert.equal(casarStatus("Fechado"), "Resolvido");
  assert.equal(casarStatus("fechado"), "Resolvido");
  assert.equal(casarStatus("Aberto"), "Pendente");
  assert.equal(casarStatus("Em Andamento"), "Em andamento");
  assert.equal(casarStatus("qualquer coisa"), "Pendente");
});

test("normalizarTemas preenche campos vazios com -", () => {
  const [tema] = normalizarTemas([
    {
      disciplina: "Esgoto",
      tema: "  Caixas de gordura  ",
      contexto: "",
      solucao: "   ",
      responsavel: "",
      prazo: "",
      status: "Em andamento",
    },
  ]);
  assert.equal(tema.tema, "Caixas de gordura");
  assert.equal(tema.contexto, "-");
  assert.equal(tema.solucao, "-");
  assert.equal(tema.responsavel, "-");
  assert.equal(tema.prazo, "-");
});

test("normalizarTemas descarta item sem título", () => {
  const temas = normalizarTemas([
    { disciplina: "Esgoto", tema: "", contexto: "x", solucao: "x", responsavel: "-", prazo: "-", status: "Pendente" },
    { disciplina: "Esgoto", tema: "Válido", contexto: "x", solucao: "x", responsavel: "-", prazo: "-", status: "Pendente" },
  ]);
  assert.equal(temas.length, 1);
  assert.equal(temas[0].tema, "Válido");
});

test("normalizarTemas é resistente a lixo", () => {
  assert.deepEqual(normalizarTemas(undefined), []);
  assert.deepEqual(normalizarTemas("não é lista"), []);
  assert.deepEqual(normalizarTemas([null, 7, "x"]), []);
});
