"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  COR_STATUS,
  DISCIPLINAS,
  Disciplina,
  STATUS_TEMA,
  StatusTema,
  Tema,
  corDaDisciplina,
} from "@/lib/domain";
import { contarPor } from "@/lib/filtros";
import { Cartao, TituloSecao, Vazio } from "./ui";

const EIXO = { fontSize: 12, fill: "#64748b" };

/** Formata o valor do tooltip; o recharts tipa o valor como possivelmente ausente. */
function rotuloTemas(valor: unknown): string {
  const n = Number(valor ?? 0);
  return `${n} tema${n === 1 ? "" : "s"}`;
}

export function GraficoPorDisciplina({ temas }: { temas: Tema[] }) {
  const dados = contarPor<Disciplina>(temas, (t) => t.disciplina, DISCIPLINAS);

  if (dados.length === 0) {
    return <Vazio titulo="Sem dados para o gráfico de disciplinas" />;
  }

  return (
    <Cartao className="p-5">
      <TituloSecao descricao="Quantos temas foram discutidos em cada disciplina.">
        Temas por disciplina
      </TituloSecao>
      <div style={{ height: Math.max(220, dados.length * 34) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dados}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <XAxis type="number" allowDecimals={false} tick={EIXO} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="nome"
              width={130}
              tick={EIXO}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              formatter={(v) => [rotuloTemas(v), "Total"]}
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
            <Bar dataKey="total" radius={[0, 4, 4, 0]} barSize={18}>
              {dados.map((d) => (
                <Cell key={d.nome} fill={corDaDisciplina(d.nome)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Cartao>
  );
}

export function GraficoPorStatus({ temas }: { temas: Tema[] }) {
  const dados = contarPor<StatusTema>(temas, (t) => t.status, STATUS_TEMA);

  if (dados.length === 0) {
    return <Vazio titulo="Sem dados para o gráfico de status" />;
  }

  return (
    <Cartao className="p-5">
      <TituloSecao descricao="Distribuição dos temas entre resolvidos, em andamento e pendentes.">
        Temas por status
      </TituloSecao>
      <div style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dados}
              dataKey="total"
              nameKey="nome"
              innerRadius={58}
              outerRadius={92}
              paddingAngle={2}
              stroke="none"
            >
              {dados.map((d) => (
                <Cell key={d.nome} fill={COR_STATUS[d.nome]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v, nome) => [rotuloTemas(v), String(nome)]}
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: "#475569" }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Cartao>
  );
}

/**
 * Status empilhado por disciplina — mostra onde estão concentradas as
 * pendências, que é a leitura que o time faz na reunião de acompanhamento.
 */
export function GraficoStatusPorDisciplina({ temas }: { temas: Tema[] }) {
  const dados = DISCIPLINAS.map((disciplina) => {
    const doGrupo = temas.filter((t) => t.disciplina === disciplina);
    return {
      nome: disciplina,
      Resolvido: doGrupo.filter((t) => t.status === "Resolvido").length,
      "Em andamento": doGrupo.filter((t) => t.status === "Em andamento").length,
      Pendente: doGrupo.filter((t) => t.status === "Pendente").length,
      total: doGrupo.length,
    };
  }).filter((d) => d.total > 0);

  if (dados.length === 0) {
    return <Vazio titulo="Sem dados para o gráfico" />;
  }

  return (
    <Cartao className="p-5">
      <TituloSecao descricao="Onde estão concentradas as pendências.">
        Status por disciplina
      </TituloSecao>
      <div style={{ height: Math.max(240, dados.length * 38) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dados}
            layout="vertical"
            margin={{ top: 4, right: 24, bottom: 4, left: 8 }}
          >
            <XAxis type="number" allowDecimals={false} tick={EIXO} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="nome"
              width={130}
              tick={EIXO}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              cursor={{ fill: "#f1f5f9" }}
              contentStyle={{ borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 12 }}
            />
            <Legend
              verticalAlign="bottom"
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: "#475569" }}
            />
            {STATUS_TEMA.map((s, i) => (
              <Bar
                key={s}
                dataKey={s}
                stackId="status"
                fill={COR_STATUS[s]}
                barSize={20}
                radius={i === STATUS_TEMA.length - 1 ? [0, 4, 4, 0] : undefined}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Cartao>
  );
}
