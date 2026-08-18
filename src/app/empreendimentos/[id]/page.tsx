"use client";

import { useMemo, useState } from "react";
import { use } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FilePlus2,
  FileText,
  Loader2,
  Printer,
  Repeat2,
} from "lucide-react";
import {
  Alerta,
  BotaoLink,
  Carregando,
  Cartao,
  Estatistica,
  Etiqueta,
  TituloSecao,
  Vazio,
} from "@/components/ui";
import { BotaoExportar } from "@/components/BotaoExportar";
import { FiltrosTemas } from "@/components/FiltrosTemas";
import {
  GraficoPorDisciplina,
  GraficoPorStatus,
} from "@/components/Graficos";
import { TabelaTemas } from "@/components/TabelaTemas";
import { TemasRecorrentes } from "@/components/TemasRecorrentes";
import { useEmpreendimento, useReunioes, useTemas } from "@/hooks/useDados";
import { FILTROS_VAZIOS, aplicarFiltros, ordenarTemas } from "@/lib/filtros";
import { COR_STATUS, ROTULO_FONTE, Reuniao } from "@/lib/domain";

export default function PainelEmpreendimento({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { dados: empreendimento, carregando: carregandoEmp } = useEmpreendimento(id);
  const { dados: reunioes } = useReunioes(id);
  // Assinamos a base inteira (e não só os temas desta obra) porque a seção de
  // recorrentes precisa enxergar as ocorrências dos outros empreendimentos —
  // é justamente o mesmo problema aparecendo em obras diferentes que interessa.
  const { dados: todosTemas, carregando, erro } = useTemas();
  const temas = useMemo(
    () => todosTemas.filter((t) => t.empreendimentoId === id),
    [todosTemas, id],
  );
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);

  const filtrados = useMemo(
    () => ordenarTemas(aplicarFiltros(temas, filtros)),
    [temas, filtros],
  );

  const contagem = useMemo(
    () => ({
      resolvidos: temas.filter((t) => t.status === "Resolvido").length,
      andamento: temas.filter((t) => t.status === "Em andamento").length,
      pendentes: temas.filter((t) => t.status === "Pendente").length,
      recorrentes: temas.filter((t) => (t.temaRecorrenteDe?.length ?? 0) > 0).length,
    }),
    [temas],
  );

  if (carregandoEmp) return <Carregando />;

  if (!empreendimento) {
    return (
      <Vazio titulo="Empreendimento não encontrado">
        <Link href="/" className="text-marca-700 underline">
          Voltar para a lista
        </Link>
      </Vazio>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Empreendimentos
        </Link>
        <TituloSecao
          descricao={
            empreendimento.localizacao ||
            "Todas as reuniões de briefing e os temas extraídos delas."
          }
          acao={
            <div className="flex flex-wrap gap-2">
              <BotaoLink href={`/relatorio/${id}`} variante="secundario">
                <Printer aria-hidden className="size-4" />
                Relatório
              </BotaoLink>
              <BotaoExportar empreendimentoId={id} />
              <BotaoLink href={`/empreendimentos/${id}/nova-reuniao`}>
                <FilePlus2 aria-hidden className="size-4" />
                Adicionar reunião
              </BotaoLink>
            </div>
          }
        >
          {empreendimento.nome}
        </TituloSecao>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Estatistica rotulo="Temas" valor={temas.length} detalhe={`${reunioes.length} reunião(ões)`} />
        <Estatistica rotulo="Resolvidos" valor={contagem.resolvidos} cor={COR_STATUS.Resolvido} />
        <Estatistica rotulo="Em andamento" valor={contagem.andamento} cor={COR_STATUS["Em andamento"]} />
        <Estatistica rotulo="Pendentes" valor={contagem.pendentes} cor={COR_STATUS.Pendente} />
        <Estatistica rotulo="Recorrentes" valor={contagem.recorrentes} cor="#7c3aed" detalhe="também vistos em outras reuniões" />
      </div>

      <section>
        <TituloSecao descricao="Origem de cada ata processada.">Reuniões</TituloSecao>
        {reunioes.length === 0 ? (
          <Vazio titulo="Nenhuma reunião adicionada ainda" icone={<FileText className="size-6" />}>
            Envie a primeira ata para começar a acumular histórico.
          </Vazio>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {reunioes.map((r) => (
              <CartaoReuniao key={r.id} reuniao={r} />
            ))}
          </div>
        )}
      </section>

      {erro ? <Alerta titulo="Não foi possível carregar os temas">{erro}</Alerta> : null}

      {carregando ? (
        <Carregando />
      ) : temas.length === 0 ? null : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            <GraficoPorDisciplina temas={temas} />
            <GraficoPorStatus temas={temas} />
          </div>

          <section className="space-y-4">
            <TituloSecao descricao="Clique numa linha para ver o texto completo.">
              Temas discutidos
            </TituloSecao>
            <FiltrosTemas
              filtros={filtros}
              onChange={setFiltros}
              reunioes={reunioes}
              totalFiltrado={filtrados.length}
              total={temas.length}
            />
            <TabelaTemas temas={filtrados} mostrarEmpreendimento={false} />
          </section>

          <section>
            <TituloSecao
              descricao="Assuntos que já apareceram em outra reunião — deste ou de outro empreendimento."
              acao={
                <Etiqueta className="bg-violet-100 text-violet-700">
                  <Repeat2 aria-hidden className="size-3.5" />
                  {contagem.recorrentes} temas
                </Etiqueta>
              }
            >
              Temas recorrentes
            </TituloSecao>
            <TemasRecorrentes temas={todosTemas} destacarEmpreendimentoId={id} />
          </section>
        </>
      )}
    </div>
  );
}

function CartaoReuniao({ reuniao }: { reuniao: Reuniao }) {
  const icone = {
    processando: <Loader2 aria-hidden className="size-4 animate-spin text-marca-600" />,
    concluido: <CheckCircle2 aria-hidden className="size-4 text-emerald-600" />,
    erro: <AlertCircle aria-hidden className="size-4 text-rose-600" />,
  }[reuniao.status];

  return (
    <Cartao className="p-4">
      <div className="flex items-start gap-2">
        {icone}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <Clock aria-hidden className="size-3.5 text-slate-400" />
            <span className="tabular-nums">{reuniao.data || "Data não identificada"}</span>
          </p>
          <p className="mt-1 truncate text-xs text-slate-500" title={reuniao.nomeArquivoOriginal ?? undefined}>
            {reuniao.nomeArquivoOriginal ?? "Texto colado"}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Etiqueta>{ROTULO_FONTE[reuniao.tipoFonte]}</Etiqueta>
            {reuniao.status === "concluido" ? (
              <Etiqueta>{reuniao.totalTemas} temas</Etiqueta>
            ) : null}
            {reuniao.status === "processando" ? (
              <Etiqueta className="bg-marca-100 text-marca-800">Processando…</Etiqueta>
            ) : null}
          </div>
          {reuniao.status === "erro" && reuniao.erro ? (
            <p className="mt-2 text-xs text-rose-700">{reuniao.erro}</p>
          ) : null}
          {reuniao.arquivoOriginalUrl ? (
            <a
              href={reuniao.arquivoOriginalUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-block text-xs font-medium text-marca-700 underline"
            >
              Ver arquivo original
            </a>
          ) : null}
        </div>
      </div>
    </Cartao>
  );
}
