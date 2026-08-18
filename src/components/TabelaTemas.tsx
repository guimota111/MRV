"use client";

import { useState } from "react";
import { ChevronDown, Repeat2 } from "lucide-react";
import clsx from "clsx";
import { Tema, corDaDisciplina } from "@/lib/domain";
import { BadgeStatus, Cartao, Etiqueta, Vazio } from "./ui";

const COLUNAS = [
  "Empreendimento",
  "Data",
  "Disciplina",
  "Tema",
  "Contexto/Discussão",
  "Solução/Encaminhamento",
  "Responsável",
  "Prazo",
  "Status",
] as const;

/**
 * Tabela principal de temas.
 *
 * Contexto e solução são longos; a tabela mostra um resumo e a linha expande
 * ao ser clicada, para caber num monitor sem virar um paredão de texto.
 */
export function TabelaTemas({
  temas,
  mostrarEmpreendimento = true,
}: {
  temas: Tema[];
  mostrarEmpreendimento?: boolean;
}) {
  const [aberta, setAberta] = useState<string | null>(null);

  if (temas.length === 0) {
    return (
      <Vazio titulo="Nenhum tema para os filtros selecionados">
        Ajuste ou limpe os filtros para ver mais resultados.
      </Vazio>
    );
  }

  const colunas = mostrarEmpreendimento
    ? COLUNAS
    : COLUNAS.filter((c) => c !== "Empreendimento");

  return (
    <Cartao className="overflow-hidden">
      <div className="rolagem-fina overflow-x-auto">
        <table className="w-full min-w-4xl border-collapse text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              {colunas.map((c) => (
                <th
                  key={c}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 font-medium"
                >
                  {c}
                </th>
              ))}
              <th scope="col" className="w-10 px-2 py-3">
                <span className="sr-only">Expandir</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {temas.map((t) => {
              const expandida = aberta === t.id;
              const recorrente = (t.temaRecorrenteDe?.length ?? 0) > 0;
              return (
                <tr
                  key={t.id}
                  onClick={() => setAberta(expandida ? null : t.id)}
                  className={clsx(
                    "cursor-pointer align-top transition-colors",
                    expandida ? "bg-marca-50/60" : "hover:bg-slate-50",
                  )}
                >
                  {mostrarEmpreendimento ? (
                    <td className="px-4 py-3 font-medium text-slate-700">
                      {t.empreendimentoNome}
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">
                    {t.dataReuniao || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Etiqueta cor={corDaDisciplina(t.disciplina)}>
                      {t.disciplina}
                    </Etiqueta>
                  </td>
                  <td className="w-56 px-4 py-3">
                    <div className="flex items-start gap-1.5">
                      <span className="font-medium text-slate-900">{t.tema}</span>
                      {recorrente ? (
                        <span
                          title={`Tema recorrente — aparece em outras ${t.temaRecorrenteDe.length} ocorrência(s)`}
                          className="mt-0.5 inline-flex shrink-0 items-center gap-0.5 rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700"
                        >
                          <Repeat2 aria-hidden className="size-3" />
                          {t.temaRecorrenteDe.length}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="w-72 px-4 py-3 text-slate-600">
                    <p className={expandida ? undefined : "line-clamp-2"}>
                      {t.contexto}
                    </p>
                  </td>
                  <td className="w-72 px-4 py-3 text-slate-600">
                    <p className={expandida ? undefined : "line-clamp-2"}>
                      {t.solucao}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{t.responsavel}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {t.prazo}
                  </td>
                  <td className="px-4 py-3">
                    <BadgeStatus status={t.status} />
                  </td>
                  <td className="px-2 py-3 text-slate-400">
                    <ChevronDown
                      aria-hidden
                      className={clsx(
                        "size-4 transition-transform",
                        expandida && "rotate-180",
                      )}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Cartao>
  );
}

/** Versão estática da tabela, usada no relatório para impressão. */
export function TabelaTemasImpressao({ temas }: { temas: Tema[] }) {
  return (
    <table className="w-full border-collapse text-left text-[11px]">
      <thead>
        <tr className="bg-slate-100 uppercase tracking-wide text-slate-600">
          {["Data", "Disciplina", "Tema", "Contexto/Discussão", "Solução/Encaminhamento", "Resp.", "Prazo", "Status"].map(
            (c) => (
              <th key={c} scope="col" className="border border-slate-300 px-2 py-1.5 font-semibold">
                {c}
              </th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        {temas.map((t) => (
          <tr key={t.id} className="quebra-evitar align-top">
            <td className="whitespace-nowrap border border-slate-300 px-2 py-1.5 tabular-nums">
              {t.dataReuniao || "—"}
            </td>
            <td className="whitespace-nowrap border border-slate-300 px-2 py-1.5">
              {t.disciplina}
            </td>
            <td className="border border-slate-300 px-2 py-1.5 font-medium">
              {t.tema}
            </td>
            <td className="border border-slate-300 px-2 py-1.5">{t.contexto}</td>
            <td className="border border-slate-300 px-2 py-1.5">{t.solucao}</td>
            <td className="border border-slate-300 px-2 py-1.5">{t.responsavel}</td>
            <td className="whitespace-nowrap border border-slate-300 px-2 py-1.5">
              {t.prazo}
            </td>
            <td className="whitespace-nowrap border border-slate-300 px-2 py-1.5">
              {t.status}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
