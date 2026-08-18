import assert from "node:assert/strict";
import { test } from "node:test";
import { agruparRecorrentes } from "./grupos";

test("ignora itens sem vínculo", () => {
  const grupos = agruparRecorrentes([
    { id: "a", temaRecorrenteDe: [] },
    { id: "b" },
  ]);
  assert.deepEqual(grupos, []);
});

test("agrupa um par simples", () => {
  const grupos = agruparRecorrentes([
    { id: "a", temaRecorrenteDe: ["b"] },
    { id: "b", temaRecorrenteDe: ["a"] },
    { id: "c", temaRecorrenteDe: [] },
  ]);
  assert.equal(grupos.length, 1);
  assert.deepEqual(grupos[0].map((t) => t.id).sort(), ["a", "b"]);
});

test("fecha a transitividade: A-B e B-C viram um grupo de três", () => {
  const grupos = agruparRecorrentes([
    { id: "a", temaRecorrenteDe: ["b"] },
    { id: "b", temaRecorrenteDe: ["a", "c"] },
    { id: "c", temaRecorrenteDe: ["b"] },
  ]);
  assert.equal(grupos.length, 1);
  assert.deepEqual(grupos[0].map((t) => t.id).sort(), ["a", "b", "c"]);
});

test("mantém grupos distintos separados", () => {
  const grupos = agruparRecorrentes([
    { id: "a", temaRecorrenteDe: ["b"] },
    { id: "b", temaRecorrenteDe: ["a"] },
    { id: "c", temaRecorrenteDe: ["d"] },
    { id: "d", temaRecorrenteDe: ["c"] },
  ]);
  assert.equal(grupos.length, 2);
});

test("aceita vínculo declarado em um lado só", () => {
  const grupos = agruparRecorrentes([
    { id: "a", temaRecorrenteDe: ["b"] },
    { id: "b" },
  ]);
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].length, 2);
});

test("ignora vínculo para tema que não está na lista", () => {
  const grupos = agruparRecorrentes([
    { id: "a", temaRecorrenteDe: ["fantasma"] },
    { id: "b", temaRecorrenteDe: [] },
  ]);
  assert.deepEqual(grupos, []);
});
