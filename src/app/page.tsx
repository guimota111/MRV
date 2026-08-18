"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, FilePlus2, MapPin, Plus } from "lucide-react";
import {
  Alerta,
  Botao,
  BotaoLink,
  Campo,
  CLASSE_INPUT,
  Carregando,
  Cartao,
  TituloSecao,
  Vazio,
} from "@/components/ui";
import { BotaoExportar } from "@/components/BotaoExportar";
import { criarEmpreendimento, useEmpreendimentos, useTemas } from "@/hooks/useDados";
import { mensagemDeErro } from "@/lib/api";

export default function PaginaEmpreendimentos() {
  const { dados: empreendimentos, carregando, erro } = useEmpreendimentos();
  const { dados: temas } = useTemas();
  const [formAberto, setFormAberto] = useState(false);

  // Contagem de temas por empreendimento, para o resumo dos cards.
  const porEmpreendimento = useMemo(() => {
    const mapa = new Map<string, { total: number; pendentes: number }>();
    for (const t of temas) {
      const atual = mapa.get(t.empreendimentoId) ?? { total: 0, pendentes: 0 };
      atual.total += 1;
      if (t.status !== "Resolvido") atual.pendentes += 1;
      mapa.set(t.empreendimentoId, atual);
    }
    return mapa;
  }, [temas]);

  return (
    <div className="space-y-6">
      <TituloSecao
        descricao="Cada empreendimento acumula as reuniões de briefing e os temas extraídos delas."
        acao={
          <div className="flex flex-wrap gap-2">
            <BotaoExportar />
            <Botao onClick={() => setFormAberto((v) => !v)}>
              <Plus aria-hidden className="size-4" />
              Novo empreendimento
            </Botao>
          </div>
        }
      >
        Empreendimentos
      </TituloSecao>

      {formAberto ? (
        <FormNovoEmpreendimento onPronto={() => setFormAberto(false)} />
      ) : null}

      {erro ? <Alerta titulo="Não foi possível carregar">{erro}</Alerta> : null}

      {carregando ? (
        <Carregando />
      ) : empreendimentos.length === 0 && !erro ? (
        <Vazio titulo="Nenhum empreendimento cadastrado" icone={<Building2 className="size-6" />}>
          Crie o primeiro empreendimento e depois adicione as atas de briefing —
          em PDF, DOCX ou texto colado.
        </Vazio>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {empreendimentos.map((e) => {
            const resumo = porEmpreendimento.get(e.id);
            return (
              <Cartao key={e.id} className="flex flex-col p-5 transition-shadow hover:shadow-md">
                <Link href={`/empreendimentos/${e.id}`} className="group">
                  <h3 className="font-semibold text-slate-900 group-hover:text-marca-700">
                    {e.nome}
                  </h3>
                  {e.localizacao ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                      <MapPin aria-hidden className="size-3.5" />
                      {e.localizacao}
                    </p>
                  ) : null}
                </Link>

                <dl className="mt-4 flex gap-6 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      Temas
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums text-slate-900">
                      {resumo?.total ?? 0}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-slate-400">
                      Em aberto
                    </dt>
                    <dd className="text-xl font-semibold tabular-nums text-amber-600">
                      {resumo?.pendentes ?? 0}
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                  <BotaoLink href={`/empreendimentos/${e.id}`} variante="secundario">
                    Abrir painel
                  </BotaoLink>
                  <BotaoLink href={`/empreendimentos/${e.id}/nova-reuniao`}>
                    <FilePlus2 aria-hidden className="size-4" />
                    Adicionar reunião
                  </BotaoLink>
                </div>
              </Cartao>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FormNovoEmpreendimento({ onPronto }: { onPronto: () => void }) {
  const [nome, setNome] = useState("");
  const [localizacao, setLocalizacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!nome.trim()) return;
    setSalvando(true);
    setErro(null);
    try {
      await criarEmpreendimento(nome, localizacao);
      setNome("");
      setLocalizacao("");
      onPronto();
    } catch (e) {
      setErro(mensagemDeErro(e));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao className="p-5">
      <form onSubmit={enviar} className="grid gap-4 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
        <Campo rotulo="Nome do empreendimento">
          <input
            autoFocus
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Residencial Spazio Jequitibá"
            className={CLASSE_INPUT}
          />
        </Campo>
        <Campo rotulo="Localização" dica="Opcional.">
          <input
            value={localizacao}
            onChange={(e) => setLocalizacao(e.target.value)}
            placeholder="Ex.: Contagem/MG"
            className={CLASSE_INPUT}
          />
        </Campo>
        <div className="flex gap-2">
          <Botao type="submit" disabled={salvando || !nome.trim()}>
            {salvando ? "Salvando…" : "Criar"}
          </Botao>
          <Botao type="button" variante="secundario" onClick={onPronto}>
            Cancelar
          </Botao>
        </div>
      </form>
      {erro ? (
        <div className="mt-4">
          <Alerta>{erro}</Alerta>
        </div>
      ) : null}
    </Cartao>
  );
}
