"use client";

import { useMemo, useState } from "react";
import { Repeat2 } from "lucide-react";
import {
  Alerta,
  Carregando,
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
  GraficoStatusPorDisciplina,
} from "@/components/Graficos";
import { TabelaTemas } from "@/components/TabelaTemas";
import { TemasRecorrentes } from "@/components/TemasRecorrentes";
import { useEmpreendimentos, useTemas } from "@/hooks/useDados";
import { FILTROS_VAZIOS, aplicarFiltros, ordenarTemas } from "@/lib/filtros";
import { COR_STATUS } from "@/lib/domain";
import { agruparRecorrentes } from "@/lib/grupos";

export default function DashboardGeral() {
  const { dados: empreendimentos } = useEmpreendimentos();
  const { dados: temas, carregando, erro } = useTemas();
  const [filtros, setFiltros] = useState(FILTROS_VAZIOS);

  const filtrados = useMemo(
    () => ordenarTemas(aplicarFiltros(temas, filtros)),
    [temas, filtros],
  );

  const resumo = useMemo(() => {
    const grupos = agruparRecorrentes(temas);
    return {
      resolvidos: temas.filter((t) => t.status === "Resolvido").length,
      andamento: temas.filter((t) => t.status === "Em andamento").length,
      pendentes: temas.filter((t) => t.status === "Pendente").length,
      grupos: grupos.length,
      // Grupos cujo mesmo assunto aparece em mais de um empreendimento.
      entreObras: grupos.filter(
        (g) => new Set(g.map((t) => t.empreendimentoId)).size > 1,
      ).length,
    };
  }, [temas]);

  return (
    <div className="space-y-8">
      <TituloSecao
        descricao="Todos os empreendimentos juntos: onde estão as pendências e o que se repete de uma obra para outra."
        acao={<BotaoExportar variante="primario" />}
      >
        Visão geral
      </TituloSecao>

      {erro ? <Alerta titulo="Não foi possível carregar">{erro}</Alerta> : null}

      {carregando ? (
        <Carregando />
      ) : temas.length === 0 ? (
        <Vazio titulo="Ainda não há temas no banco">
          Processe a primeira ata em algum empreendimento para popular o painel.
        </Vazio>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Estatistica
              rotulo="Temas"
              valor={temas.length}
              detalhe={`${empreendimentos.length} empreendimento(s)`}
            />
            <Estatistica rotulo="Resolvidos" valor={resumo.resolvidos} cor={COR_STATUS.Resolvido} />
            <Estatistica rotulo="Em andamento" valor={resumo.andamento} cor={COR_STATUS["Em andamento"]} />
            <Estatistica rotulo="Pendentes" valor={resumo.pendentes} cor={COR_STATUS.Pendente} />
            <Estatistica rotulo="Grupos recorrentes" valor={resumo.grupos} cor="#7c3aed" />
            <Estatistica
              rotulo="Entre obras"
              valor={resumo.entreObras}
              cor="#7c3aed"
              detalhe="grupos em 2+ empreendimentos"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <GraficoPorDisciplina temas={temas} />
            <GraficoPorStatus temas={temas} />
          </div>
          <GraficoStatusPorDisciplina temas={temas} />

          <section>
            <TituloSecao
              descricao="O mesmo assunto reaparecendo em reuniões e obras diferentes — o sinal mais útil para padronizar projeto."
              acao={
                <Etiqueta className="bg-violet-100 text-violet-700">
                  <Repeat2 aria-hidden className="size-3.5" />
                  {resumo.grupos} grupos
                </Etiqueta>
              }
            >
              Temas recorrentes
            </TituloSecao>
            <TemasRecorrentes temas={temas} />
          </section>

          <section className="space-y-4">
            <TituloSecao descricao="Tabela completa, filtrável por empreendimento, disciplina, status e período.">
              Todos os temas
            </TituloSecao>
            <FiltrosTemas
              filtros={filtros}
              onChange={setFiltros}
              empreendimentos={empreendimentos}
              totalFiltrado={filtrados.length}
              total={temas.length}
            />
            <TabelaTemas temas={filtrados} />
          </section>
        </>
      )}
    </div>
  );
}
