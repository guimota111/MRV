import assert from "node:assert/strict";
import { test } from "node:test";
import { Tema } from "./domain";
import {
  FILTROS_VAZIOS,
  aplicarFiltros,
  chaveData,
  contarPor,
  filtrosAtivos,
  ordenarTemas,
  paraIso,
} from "./filtros";

function tema(over: Partial<Tema> = {}): Tema {
  return {
    id: "t1",
    empreendimentoId: "e1",
    empreendimentoNome: "Spazio Jequitibá",
    reuniaoId: "r1",
    dataReuniao: "14/03/2025",
    disciplina: "Água Fria",
    tema: "Prumadas superdimensionadas",
    contexto: "DN40 onde o cálculo indica DN32",
    solucao: "Padronizar em DN32",
    responsavel: "Eng. Marcelo",
    prazo: "-",
    status: "Resolvido",
    temaRecorrenteDe: [],
    ...over,
  };
}

test("paraIso converte DD/MM/AAAA", () => {
  assert.equal(paraIso("14/03/2025"), "2025-03-14");
  assert.equal(paraIso("sem data"), "");
  assert.equal(paraIso(""), "");
});

test("chaveData joga data inválida para o fim", () => {
  assert.equal(chaveData("14/03/2025"), "2025-03-14");
  assert.equal(chaveData(""), "9999-99-99");
});

test("sem filtros, devolve tudo", () => {
  const temas = [tema(), tema({ id: "t2" })];
  assert.equal(aplicarFiltros(temas, FILTROS_VAZIOS).length, 2);
});

test("filtra por empreendimento, disciplina e status", () => {
  const temas = [
    tema({ id: "a" }),
    tema({ id: "b", empreendimentoId: "e2" }),
    tema({ id: "c", disciplina: "Esgoto" }),
    tema({ id: "d", status: "Pendente" }),
  ];
  assert.deepEqual(
    aplicarFiltros(temas, { ...FILTROS_VAZIOS, empreendimentoIds: ["e2"] }).map((t) => t.id),
    ["b"],
  );
  assert.deepEqual(
    aplicarFiltros(temas, { ...FILTROS_VAZIOS, disciplinas: ["Esgoto"] }).map((t) => t.id),
    ["c"],
  );
  assert.deepEqual(
    aplicarFiltros(temas, { ...FILTROS_VAZIOS, status: ["Pendente"] }).map((t) => t.id),
    ["d"],
  );
});

test("filtros de seleção múltipla somam (OU dentro do grupo)", () => {
  const temas = [
    tema({ id: "a", status: "Resolvido" }),
    tema({ id: "b", status: "Pendente" }),
    tema({ id: "c", status: "Em andamento" }),
  ];
  const r = aplicarFiltros(temas, {
    ...FILTROS_VAZIOS,
    status: ["Resolvido", "Pendente"],
  });
  assert.deepEqual(r.map((t) => t.id), ["a", "b"]);
});

test("busca ignora acento e caixa", () => {
  const temas = [tema({ id: "a", tema: "Caixa de gordura" }), tema({ id: "b", tema: "Prumada" })];
  assert.deepEqual(
    aplicarFiltros(temas, { ...FILTROS_VAZIOS, busca: "GORDURA" }).map((t) => t.id),
    ["a"],
  );
  const comAcento = [tema({ id: "a", tema: "Reservatório superior" })];
  assert.equal(
    aplicarFiltros(comAcento, { ...FILTROS_VAZIOS, busca: "reservatorio" }).length,
    1,
  );
});

test("busca exige todos os termos, em qualquer ordem", () => {
  const temas = [
    tema({ id: "a", tema: "Caixa de gordura", contexto: "área externa" }),
    tema({ id: "b", tema: "Caixa de inspeção", contexto: "garagem" }),
  ];
  assert.deepEqual(
    aplicarFiltros(temas, { ...FILTROS_VAZIOS, busca: "externa caixa" }).map((t) => t.id),
    ["a"],
  );
});

test("busca cobre contexto, solução, responsável e empreendimento", () => {
  const temas = [tema()];
  for (const termo of ["DN32", "Padronizar", "Marcelo", "Jequitiba"]) {
    assert.equal(
      aplicarFiltros(temas, { ...FILTROS_VAZIOS, busca: termo }).length,
      1,
      `busca por "${termo}" deveria encontrar`,
    );
  }
});

test("intervalo de datas é inclusivo nas duas pontas", () => {
  const temas = [
    tema({ id: "a", dataReuniao: "01/03/2025" }),
    tema({ id: "b", dataReuniao: "15/03/2025" }),
    tema({ id: "c", dataReuniao: "31/03/2025" }),
  ];
  const r = aplicarFiltros(temas, {
    ...FILTROS_VAZIOS,
    dataDe: "2025-03-01",
    dataAte: "2025-03-31",
  });
  assert.deepEqual(r.map((t) => t.id), ["a", "b", "c"]);

  const so15 = aplicarFiltros(temas, {
    ...FILTROS_VAZIOS,
    dataDe: "2025-03-10",
    dataAte: "2025-03-20",
  });
  assert.deepEqual(so15.map((t) => t.id), ["b"]);
});

test("tema sem data não passa por filtro de intervalo", () => {
  const temas = [tema({ id: "a", dataReuniao: "" })];
  assert.equal(
    aplicarFiltros(temas, { ...FILTROS_VAZIOS, dataDe: "2025-01-01" }).length,
    0,
  );
  // Mas continua aparecendo quando não há filtro de data.
  assert.equal(aplicarFiltros(temas, FILTROS_VAZIOS).length, 1);
});

test("somenteRecorrentes filtra quem não tem vínculo", () => {
  const temas = [
    tema({ id: "a", temaRecorrenteDe: ["x"] }),
    tema({ id: "b", temaRecorrenteDe: [] }),
  ];
  assert.deepEqual(
    aplicarFiltros(temas, { ...FILTROS_VAZIOS, somenteRecorrentes: true }).map((t) => t.id),
    ["a"],
  );
});

test("filtros combinam com E entre grupos", () => {
  const temas = [
    tema({ id: "a", disciplina: "Esgoto", status: "Pendente" }),
    tema({ id: "b", disciplina: "Esgoto", status: "Resolvido" }),
  ];
  const r = aplicarFiltros(temas, {
    ...FILTROS_VAZIOS,
    disciplinas: ["Esgoto"],
    status: ["Pendente"],
  });
  assert.deepEqual(r.map((t) => t.id), ["a"]);
});

test("filtrosAtivos conta cada critério em uso", () => {
  assert.equal(filtrosAtivos(FILTROS_VAZIOS), 0);
  assert.equal(
    filtrosAtivos({
      ...FILTROS_VAZIOS,
      disciplinas: ["Esgoto", "Drenagem"],
      busca: "caixa",
      dataDe: "2025-01-01",
    }),
    4,
  );
  // Busca só com espaços não conta.
  assert.equal(filtrosAtivos({ ...FILTROS_VAZIOS, busca: "   " }), 0);
});

test("contarPor respeita a ordem dada e omite zeros", () => {
  const temas = [
    tema({ status: "Pendente" }),
    tema({ id: "t2", status: "Pendente" }),
    tema({ id: "t3", status: "Resolvido" }),
  ];
  const r = contarPor(temas, (t) => t.status, ["Resolvido", "Em andamento", "Pendente"] as const);
  assert.deepEqual(r, [
    { nome: "Resolvido", total: 1 },
    { nome: "Pendente", total: 2 },
  ]);
});

test("ordenarTemas: empreendimento, depois data mais recente primeiro", () => {
  const temas = [
    tema({ id: "a", empreendimentoNome: "Zeta", dataReuniao: "01/01/2025" }),
    tema({ id: "b", empreendimentoNome: "Alfa", dataReuniao: "01/01/2025" }),
    tema({ id: "c", empreendimentoNome: "Alfa", dataReuniao: "10/06/2025" }),
  ];
  assert.deepEqual(ordenarTemas(temas).map((t) => t.id), ["c", "b", "a"]);
});

test("ordenarTemas não muda o array original", () => {
  const temas = [tema({ id: "a", empreendimentoNome: "Zeta" }), tema({ id: "b", empreendimentoNome: "Alfa" })];
  ordenarTemas(temas);
  assert.deepEqual(temas.map((t) => t.id), ["a", "b"]);
});
