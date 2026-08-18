"use client";

import { Building2, Repeat2 } from "lucide-react";
import { Tema, corDaDisciplina } from "@/lib/domain";
import { agruparRecorrentes } from "@/lib/grupos";
import { chaveData } from "@/lib/filtros";
import { BadgeStatus, Cartao, Etiqueta, Vazio } from "./ui";

/**
 * Lista os grupos de temas ligados por `temaRecorrenteDe`, mostrando em quais
 * empreendimentos e reuniões cada assunto apareceu.
 *
 * Grupos que atravessam empreendimentos vêm primeiro: são o achado mais
 * interessante da ferramenta — o mesmo problema se repetindo em obras
 * diferentes.
 */
export function TemasRecorrentes({
  temas,
  destacarEmpreendimentoId,
  vazioTexto,
}: {
  /** Passe SEMPRE a base completa de temas — a recorrência mais interessante
   *  cruza empreendimentos, e agrupar só os temas de uma obra a esconderia. */
  temas: Tema[];
  /** No painel de uma obra: mostra só os grupos que a incluem, mas com todas
   *  as ocorrências do grupo, inclusive as de outros empreendimentos. */
  destacarEmpreendimentoId?: string;
  vazioTexto?: string;
}) {
  const grupos = agruparRecorrentes(temas)
    .filter(
      (grupo) =>
        !destacarEmpreendimentoId ||
        grupo.some((t) => t.empreendimentoId === destacarEmpreendimentoId),
    )
    .map((grupo) => ({
      temas: [...grupo].sort((a, b) =>
        chaveData(a.dataReuniao).localeCompare(chaveData(b.dataReuniao)),
      ),
      empreendimentos: new Set(grupo.map((t) => t.empreendimentoId)).size,
    }))
    .sort((a, b) => {
      if (b.empreendimentos !== a.empreendimentos) {
        return b.empreendimentos - a.empreendimentos;
      }
      return b.temas.length - a.temas.length;
    });

  if (grupos.length === 0) {
    return (
      <Vazio titulo="Nenhum tema recorrente identificado" icone={<Repeat2 className="size-6" />}>
        {vazioTexto ??
          "A detecção roda em segundo plano depois de cada ata processada. Assim que dois temas forem reconhecidos como o mesmo assunto, eles aparecem aqui."}
      </Vazio>
    );
  }

  return (
    <div className="space-y-4">
      {grupos.map((grupo) => {
        const primeiro = grupo.temas[0];
        const entreObras = grupo.empreendimentos > 1;
        return (
          <Cartao key={primeiro.id} className="quebra-evitar overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-5 py-3">
              <Etiqueta cor={corDaDisciplina(primeiro.disciplina)}>
                {primeiro.disciplina}
              </Etiqueta>
              <h3 className="font-medium text-slate-900">{primeiro.tema}</h3>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
                <Repeat2 aria-hidden className="size-3.5" />
                {grupo.temas.length} ocorrências
              </span>
              {entreObras ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-marca-100 px-2.5 py-0.5 text-xs font-medium text-marca-800">
                  <Building2 aria-hidden className="size-3.5" />
                  {grupo.empreendimentos} empreendimentos
                </span>
              ) : null}
            </div>

            <ol className="divide-y divide-slate-100">
              {grupo.temas.map((t) => (
                <li key={t.id} className="grid gap-2 px-5 py-3 sm:grid-cols-[13rem_1fr]">
                  <div className="text-sm">
                    <p className="font-medium text-slate-700">
                      {t.empreendimentoNome}
                    </p>
                    <p className="tabular-nums text-slate-500">
                      {t.dataReuniao || "sem data"}
                    </p>
                    <div className="mt-1.5">
                      <BadgeStatus status={t.status} />
                    </div>
                  </div>
                  <div className="text-sm text-slate-600">
                    <p className="font-medium text-slate-800">{t.tema}</p>
                    <p className="mt-1">{t.contexto}</p>
                    {t.solucao && t.solucao !== "-" ? (
                      <p className="mt-1">
                        <span className="font-medium text-slate-700">
                          Encaminhamento:{" "}
                        </span>
                        {t.solucao}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          </Cartao>
        );
      })}
    </div>
  );
}
