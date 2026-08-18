"use client";

import { use, useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Botao, Carregando, Vazio } from "@/components/ui";
import { TabelaTemasImpressao } from "@/components/TabelaTemas";
import { useEmpreendimento, useReunioes, useTemas } from "@/hooks/useDados";
import { chaveData } from "@/lib/filtros";
import { DISCIPLINAS, ROTULO_FONTE, STATUS_TEMA, Tema } from "@/lib/domain";
import { agruparRecorrentes } from "@/lib/grupos";

/**
 * Versão para impressão / "Salvar como PDF" do navegador.
 *
 * Sem filtros, sem linhas expansíveis, sem navegação: só o conteúdo, agrupado
 * por disciplina, com as regras de `@media print` do globals.css cuidando das
 * quebras de página.
 */
export default function Relatorio({
  params,
}: {
  params: Promise<{ empreendimentoId: string }>;
}) {
  const { empreendimentoId } = use(params);
  const { dados: empreendimento, carregando } = useEmpreendimento(empreendimentoId);
  const { dados: reunioes } = useReunioes(empreendimentoId);
  // Base completa: os grupos recorrentes deste empreendimento podem incluir
  // ocorrências de outras obras, e o relatório precisa mostrá-las.
  const { dados: todosTemas, carregando: carregandoTemas } = useTemas();
  const temas = useMemo(
    () => todosTemas.filter((t) => t.empreendimentoId === empreendimentoId),
    [todosTemas, empreendimentoId],
  );

  useEffect(() => {
    if (empreendimento) {
      document.title = `Briefings — ${empreendimento.nome}`;
    }
  }, [empreendimento]);

  const porDisciplina = useMemo(() => {
    return DISCIPLINAS.map((disciplina) => ({
      disciplina,
      temas: temas
        .filter((t) => t.disciplina === disciplina)
        .sort((a, b) => chaveData(a.dataReuniao).localeCompare(chaveData(b.dataReuniao))),
    })).filter((g) => g.temas.length > 0);
  }, [temas]);

  const grupos = useMemo(
    () =>
      agruparRecorrentes(todosTemas).filter((g) =>
        g.some((t) => t.empreendimentoId === empreendimentoId),
      ),
    [todosTemas, empreendimentoId],
  );

  const contagem = useMemo(
    () =>
      STATUS_TEMA.map((status) => ({
        status,
        total: temas.filter((t) => t.status === status).length,
      })),
    [temas],
  );

  if (carregando || carregandoTemas) return <Carregando />;
  if (!empreendimento) {
    return (
      <Vazio titulo="Empreendimento não encontrado">
        <Link href="/" className="text-marca-700 underline">
          Voltar para a lista
        </Link>
      </Vazio>
    );
  }

  const reunioesOrdenadas = [...reunioes]
    .filter((r) => r.status === "concluido")
    .sort((a, b) => chaveData(a.data).localeCompare(chaveData(b.data)));

  return (
    <div className="mx-auto max-w-4xl bg-white">
      <div className="sem-impressao mb-6 flex items-center justify-between">
        <Link
          href={`/empreendimentos/${empreendimentoId}`}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Voltar ao painel
        </Link>
        <Botao onClick={() => window.print()}>
          <Printer aria-hidden className="size-4" />
          Imprimir / Salvar PDF
        </Botao>
      </div>

      <article className="space-y-8 text-slate-900">
        <header className="border-b-2 border-slate-900 pb-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            MRV Engenharia — Briefing de Instalações
          </p>
          <h1 className="mt-2 text-2xl font-bold">{empreendimento.nome}</h1>
          {empreendimento.localizacao ? (
            <p className="mt-0.5 text-sm text-slate-600">{empreendimento.localizacao}</p>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            Consolidado de {reunioesOrdenadas.length} reunião(ões) ·{" "}
            {temas.length} tema(s) · emitido em{" "}
            {new Date().toLocaleDateString("pt-BR")}
          </p>
        </header>

        <section className="quebra-evitar">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
            Resumo
          </h2>
          <div className="flex flex-wrap gap-6 text-sm">
            {contagem.map((c) => (
              <div key={c.status}>
                <span className="block text-2xl font-bold tabular-nums">{c.total}</span>
                <span className="text-slate-600">{c.status}</span>
              </div>
            ))}
            <div>
              <span className="block text-2xl font-bold tabular-nums">{grupos.length}</span>
              <span className="text-slate-600">Grupos recorrentes</span>
            </div>
          </div>
        </section>

        <section className="quebra-evitar">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">
            Reuniões consolidadas
          </h2>
          {reunioesOrdenadas.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma reunião processada.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {reunioesOrdenadas.map((r) => (
                <li key={r.id} className="flex flex-wrap gap-x-3 text-slate-700">
                  <span className="font-medium tabular-nums">
                    {r.data || "sem data"}
                  </span>
                  <span className="text-slate-500">{ROTULO_FONTE[r.tipoFonte]}</span>
                  {r.nomeArquivoOriginal ? (
                    <span className="text-slate-500">{r.nomeArquivoOriginal}</span>
                  ) : null}
                  <span className="text-slate-500">{r.totalTemas} tema(s)</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {porDisciplina.map((grupo) => (
          <section key={grupo.disciplina} className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              {grupo.disciplina}{" "}
              <span className="font-normal text-slate-500">
                ({grupo.temas.length})
              </span>
            </h2>
            <TabelaTemasImpressao temas={grupo.temas} />
          </section>
        ))}

        {grupos.length > 0 ? (
          <section className="pagina-nova space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">
              Temas recorrentes
            </h2>
            <p className="text-xs text-slate-500">
              Assuntos identificados como o mesmo tema em mais de uma reunião,
              incluindo outros empreendimentos.
            </p>
            {grupos.map((grupo, i) => (
              <GrupoRecorrenteImpressao key={grupo[0].id} indice={i + 1} temas={grupo} />
            ))}
          </section>
        ) : null}

        <footer className="border-t border-slate-300 pt-3 text-[10px] text-slate-500">
          Documento gerado automaticamente a partir das atas de briefing. A
          extração dos temas é assistida por IA — confira o conteúdo contra as
          atas originais antes de usar em decisão de projeto.
        </footer>
      </article>
    </div>
  );
}

function GrupoRecorrenteImpressao({
  indice,
  temas,
}: {
  indice: number;
  temas: Tema[];
}) {
  const ordenados = [...temas].sort((a, b) =>
    chaveData(a.dataReuniao).localeCompare(chaveData(b.dataReuniao)),
  );
  const obras = new Set(temas.map((t) => t.empreendimentoId)).size;

  return (
    <div className="quebra-evitar border border-slate-300 p-3 text-xs">
      <p className="font-semibold">
        {indice}. {ordenados[0].tema}{" "}
        <span className="font-normal text-slate-500">
          — {ordenados[0].disciplina} · {temas.length} ocorrências
          {obras > 1 ? ` · ${obras} empreendimentos` : ""}
        </span>
      </p>
      <ul className="mt-1.5 space-y-1">
        {ordenados.map((t) => (
          <li key={t.id} className="text-slate-700">
            <span className="font-medium">{t.empreendimentoNome}</span>
            {" · "}
            <span className="tabular-nums">{t.dataReuniao || "sem data"}</span>
            {" · "}
            <span>{t.status}</span>
            <span className="block text-slate-600">{t.contexto}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
