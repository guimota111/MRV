import assert from "node:assert/strict";
import { test } from "node:test";
import { detectarTipo, htmlParaTexto } from "./documento";

test("detectarTipo reconhece pdf e docx, ignorando caixa", () => {
  assert.equal(detectarTipo("ata.pdf"), "pdf");
  assert.equal(detectarTipo("ATA.PDF"), "pdf");
  assert.equal(detectarTipo("ata manual.docx"), "docx");
  assert.equal(detectarTipo("ata.doc"), null);
  assert.equal(detectarTipo("ata.txt"), null);
});

test("htmlParaTexto quebra linha nos blocos", () => {
  const texto = htmlParaTexto("<h1>Água Fria</h1><p>Primeiro</p><p>Segundo</p>");
  assert.equal(texto, "Água Fria\nPrimeiro\nSegundo");
});

test("htmlParaTexto remove imagens", () => {
  const texto = htmlParaTexto(
    '<p>Antes</p><p><img src="data:image/png;base64,AAAA"/></p><p>Depois</p>',
  );
  assert.ok(!texto.includes("base64"));
  // O parágrafo que só continha a imagem vira uma linha em branco.
  assert.equal(texto, "Antes\n\nDepois");
});

test("htmlParaTexto separa células de tabela com |", () => {
  const texto = htmlParaTexto(
    "<table><tr><td>1.1</td><td>Prumada DN40</td><td>Fechado</td></tr></table>",
  );
  assert.equal(texto, "1.1 | Prumada DN40 | Fechado");
});

test("htmlParaTexto mantém uma linha por linha de tabela", () => {
  const texto = htmlParaTexto(
    "<table><tr><td>1.1</td><td>Prumada</td></tr><tr><td>1.2</td><td>Reservatório</td></tr></table>",
  );
  assert.equal(texto, "1.1 | Prumada\n1.2 | Reservatório");
});

test("htmlParaTexto preserva o | dentro do texto da célula", () => {
  assert.equal(htmlParaTexto("<p>DN40 | DN32</p>"), "DN40 | DN32");
});

test("htmlParaTexto decodifica entidades", () => {
  assert.equal(htmlParaTexto("<p>A &amp; B &lt;x&gt; &quot;y&quot;</p>"), 'A & B <x> "y"');
});

test("htmlParaTexto colapsa linhas em branco repetidas", () => {
  const texto = htmlParaTexto("<p>A</p><p></p><p></p><p>B</p>");
  assert.equal(texto, "A\n\nB");
});
