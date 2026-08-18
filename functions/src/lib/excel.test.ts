import assert from "node:assert/strict";
import { test } from "node:test";
import ExcelJS from "exceljs";
import { Tema } from "../domain";
import { gerarWorkbook, nomeArquivoExport } from "./excel";

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

async function abrir(temas: Tema[]) {
  const buffer = await gerarWorkbook(temas);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

test("cria Resumo Geral, uma aba por empreendimento, Recorrentes e Status", async () => {
  const wb = await abrir([
    tema(),
    tema({ id: "t2", empreendimentoId: "e2", empreendimentoNome: "Chapada dos Buritis" }),
  ]);
  const nomes = wb.worksheets.map((w) => w.name);
  assert.deepEqual(nomes, [
    "Resumo Geral",
    "Chapada dos Buritis",
    "Spazio Jequitibá",
    "Temas Recorrentes",
    "Status",
  ]);
});

test("Resumo Geral tem as 9 colunas e uma linha por tema", async () => {
  const wb = await abrir([tema(), tema({ id: "t2" })]);
  const aba = wb.getWorksheet("Resumo Geral");
  assert.ok(aba);
  const cabecalho = aba.getRow(1).values as unknown[];
  assert.deepEqual(cabecalho.slice(1), [
    "Empreendimento", "Data", "Disciplina", "Tema", "Contexto/Discussão",
    "Solução/Encaminhamento", "Responsável", "Prazo", "Status",
  ]);
  assert.equal(aba.rowCount, 3);
});

test("cabeçalho em negrito e AutoFilter habilitado", async () => {
  const wb = await abrir([tema()]);
  const aba = wb.getWorksheet("Resumo Geral");
  assert.equal(aba?.getRow(1).font?.bold, true);
  assert.ok(aba?.autoFilter, "AutoFilter deve estar definido");
});

test("célula de status recebe a cor do status", async () => {
  const wb = await abrir([
    tema({ status: "Resolvido" }),
    tema({ id: "t2", status: "Pendente" }),
  ]);
  const aba = wb.getWorksheet("Resumo Geral");
  const cor = (linha: number) =>
    (aba?.getRow(linha).getCell(9).fill as ExcelJS.FillPattern)?.fgColor?.argb;
  assert.equal(cor(2), "FFD1FAE5"); // verde
  assert.equal(cor(3), "FFFEE2E2"); // vermelho
  assert.notEqual(cor(2), cor(3));
});

test("aba Status conta por status e fecha no total", async () => {
  const wb = await abrir([
    tema({ status: "Resolvido" }),
    tema({ id: "t2", status: "Pendente" }),
    tema({ id: "t3", status: "Pendente" }),
  ]);
  const aba = wb.getWorksheet("Status");
  assert.ok(aba);
  const linhas = new Map<string, number>();
  aba.eachRow((row, i) => {
    if (i === 1) return;
    linhas.set(String(row.getCell(1).value), Number(row.getCell(2).value));
  });
  assert.equal(linhas.get("Resolvido"), 1);
  assert.equal(linhas.get("Em andamento"), 0);
  assert.equal(linhas.get("Pendente"), 2);
  assert.equal(linhas.get("Total"), 3);
});

test("aba Temas Recorrentes agrupa os vinculados e numera os grupos", async () => {
  const wb = await abrir([
    tema({ id: "a", temaRecorrenteDe: ["b"] }),
    tema({ id: "b", empreendimentoNome: "Chapada dos Buritis", empreendimentoId: "e2", temaRecorrenteDe: ["a"] }),
    tema({ id: "c" }),
  ]);
  const aba = wb.getWorksheet("Temas Recorrentes");
  assert.ok(aba);
  const grupos = new Set<number>();
  aba.eachRow((row, i) => {
    if (i === 1) return;
    const g = row.getCell(1).value;
    if (typeof g === "number") grupos.add(g);
  });
  assert.deepEqual([...grupos], [1], "só o par a/b é recorrente");
});

test("aba Temas Recorrentes também tem AutoFilter", async () => {
  const wb = await abrir([
    tema({ id: "a", temaRecorrenteDe: ["b"] }),
    tema({ id: "b", temaRecorrenteDe: ["a"] }),
  ]);
  assert.ok(wb.getWorksheet("Temas Recorrentes")?.autoFilter);
});

test("Temas Recorrentes não tem linha em branco entre grupos", async () => {
  const wb = await abrir([
    tema({ id: "a", temaRecorrenteDe: ["b"] }),
    tema({ id: "b", temaRecorrenteDe: ["a"] }),
    tema({ id: "c", temaRecorrenteDe: ["d"] }),
    tema({ id: "d", temaRecorrenteDe: ["c"] }),
  ]);
  const aba = wb.getWorksheet("Temas Recorrentes");
  // 1 cabeçalho + 4 temas, sem separadores.
  assert.equal(aba?.rowCount, 5);
});

test("aba Temas Recorrentes informa quando não há nenhum", async () => {
  const wb = await abrir([tema()]);
  const aba = wb.getWorksheet("Temas Recorrentes");
  assert.match(String(aba?.getRow(2).getCell(2).value), /Nenhum tema recorrente/);
});

test("nomes de aba longos são cortados em 31 caracteres", async () => {
  const wb = await abrir([
    tema({ empreendimentoNome: "Residencial Parque das Palmeiras Fase 2 Torre A" }),
  ]);
  for (const aba of wb.worksheets) {
    assert.ok(aba.name.length <= 31, `"${aba.name}" tem ${aba.name.length} caracteres`);
  }
});

test("workbook sem temas ainda abre", async () => {
  const wb = await abrir([]);
  assert.deepEqual(wb.worksheets.map((w) => w.name), [
    "Resumo Geral", "Temas Recorrentes", "Status",
  ]);
});

test("nomeArquivoExport gera nome seguro", () => {
  assert.match(nomeArquivoExport("Spazio Jequitibá"), /^briefings-spazio-jequitiba-\d{4}-\d{2}-\d{2}\.xlsx$/);
  assert.match(nomeArquivoExport("geral"), /^briefings-geral-/);
});
