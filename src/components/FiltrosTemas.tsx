"use client";

import clsx from "clsx";
import { Search, X } from "lucide-react";
import {
  DISCIPLINAS,
  Disciplina,
  Empreendimento,
  Reuniao,
  STATUS_TEMA,
  StatusTema,
  corDaDisciplina,
} from "@/lib/domain";
import { FILTROS_VAZIOS, Filtros, filtrosAtivos } from "@/lib/filtros";
import { CLASSE_INPUT, Botao, Cartao } from "./ui";

/** Alterna um valor dentro de uma lista de seleção múltipla. */
function alternar<T>(lista: T[], valor: T): T[] {
  return lista.includes(valor)
    ? lista.filter((v) => v !== valor)
    : [...lista, valor];
}

function Chip({
  ativo,
  cor,
  onClick,
  children,
}: {
  ativo: boolean;
  cor?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
        ativo
          ? "bg-marca-700 text-white"
          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
      )}
    >
      {cor ? (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: ativo ? "#ffffff" : cor }}
        />
      ) : null}
      {children}
    </button>
  );
}

export function FiltrosTemas({
  filtros,
  onChange,
  empreendimentos,
  reunioes,
  totalFiltrado,
  total,
}: {
  filtros: Filtros;
  onChange: (f: Filtros) => void;
  /** Omitido no dashboard de um empreendimento só. */
  empreendimentos?: Empreendimento[];
  /** Omitido no dashboard geral. */
  reunioes?: Reuniao[];
  totalFiltrado: number;
  total: number;
}) {
  const ativos = filtrosAtivos(filtros);

  return (
    <Cartao className="p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={filtros.busca}
            onChange={(e) => onChange({ ...filtros, busca: e.target.value })}
            placeholder="Buscar em tema, contexto, solução ou responsável…"
            aria-label="Buscar temas"
            className={clsx(CLASSE_INPUT, "pl-9")}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-slate-500">De</span>
          <input
            type="date"
            value={filtros.dataDe}
            onChange={(e) => onChange({ ...filtros, dataDe: e.target.value })}
            aria-label="Data inicial"
            className={clsx(CLASSE_INPUT, "w-40")}
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <span className="text-slate-500">até</span>
          <input
            type="date"
            value={filtros.dataAte}
            onChange={(e) => onChange({ ...filtros, dataAte: e.target.value })}
            aria-label="Data final"
            className={clsx(CLASSE_INPUT, "w-40")}
          />
        </label>

        {ativos > 0 ? (
          <Botao
            variante="sutil"
            onClick={() => onChange(FILTROS_VAZIOS)}
            className="text-slate-500"
          >
            <X aria-hidden className="size-4" />
            Limpar {ativos} filtro{ativos > 1 ? "s" : ""}
          </Botao>
        ) : null}
      </div>

      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
        {empreendimentos && empreendimentos.length > 0 ? (
          <GrupoChips rotulo="Empreendimento">
            {empreendimentos.map((e) => (
              <Chip
                key={e.id}
                ativo={filtros.empreendimentoIds.includes(e.id)}
                onClick={() =>
                  onChange({
                    ...filtros,
                    empreendimentoIds: alternar(filtros.empreendimentoIds, e.id),
                  })
                }
              >
                {e.nome}
              </Chip>
            ))}
          </GrupoChips>
        ) : null}

        <GrupoChips rotulo="Disciplina">
          {DISCIPLINAS.map((d: Disciplina) => (
            <Chip
              key={d}
              ativo={filtros.disciplinas.includes(d)}
              cor={corDaDisciplina(d)}
              onClick={() =>
                onChange({
                  ...filtros,
                  disciplinas: alternar(filtros.disciplinas, d),
                })
              }
            >
              {d}
            </Chip>
          ))}
        </GrupoChips>

        <GrupoChips rotulo="Status">
          {STATUS_TEMA.map((s: StatusTema) => (
            <Chip
              key={s}
              ativo={filtros.status.includes(s)}
              onClick={() =>
                onChange({ ...filtros, status: alternar(filtros.status, s) })
              }
            >
              {s}
            </Chip>
          ))}
          <Chip
            ativo={filtros.somenteRecorrentes}
            onClick={() =>
              onChange({
                ...filtros,
                somenteRecorrentes: !filtros.somenteRecorrentes,
              })
            }
          >
            Só recorrentes
          </Chip>
        </GrupoChips>

        {reunioes && reunioes.length > 0 ? (
          <GrupoChips rotulo="Reunião">
            {reunioes.map((r) => (
              <Chip
                key={r.id}
                ativo={filtros.reuniaoIds.includes(r.id)}
                onClick={() =>
                  onChange({
                    ...filtros,
                    reuniaoIds: alternar(filtros.reuniaoIds, r.id),
                  })
                }
              >
                {r.data || "sem data"}
                {r.nomeArquivoOriginal ? ` · ${r.nomeArquivoOriginal}` : ""}
              </Chip>
            ))}
          </GrupoChips>
        ) : null}
      </div>

      <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
        Mostrando <strong className="text-slate-700">{totalFiltrado}</strong> de{" "}
        {total} tema{total === 1 ? "" : "s"}.
      </p>
    </Cartao>
  );
}

function GrupoChips({
  rotulo,
  children,
}: {
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="w-28 shrink-0 text-xs font-medium uppercase tracking-wide text-slate-400">
        {rotulo}
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
