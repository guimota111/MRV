"use client";

import { use, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardType,
  FileUp,
  Loader2,
  Upload,
  X,
} from "lucide-react";
import clsx from "clsx";
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
import {
  RespostaProcessarAta,
  detectarRecorrencia,
  enviarArquivo,
  mensagemDeErro,
  processarAta,
} from "@/lib/api";
import { useEmpreendimento } from "@/hooks/useDados";

type Modo = "arquivo" | "texto";

type Etapa =
  | { fase: "parado" }
  | { fase: "enviando" }
  | { fase: "extraindo" }
  | { fase: "recorrencia"; resultado: RespostaProcessarAta }
  | { fase: "pronto"; resultado: RespostaProcessarAta; vinculos: number | null };

const EXTENSOES_ACEITAS = ".pdf,.docx";
/** Acima disso o upload fica lento o bastante para valer um aviso. */
const AVISO_TAMANHO_MB = 25;

export default function NovaReuniao({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { dados: empreendimento, carregando } = useEmpreendimento(id);

  const [modo, setModo] = useState<Modo>("arquivo");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [texto, setTexto] = useState("");
  const [dataReuniao, setDataReuniao] = useState("");
  const [arrastando, setArrastando] = useState(false);
  const [etapa, setEtapa] = useState<Etapa>({ fase: "parado" });
  const [erro, setErro] = useState<string | null>(null);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const ocupado = etapa.fase !== "parado" && etapa.fase !== "pronto";

  const podeEnviar = useMemo(() => {
    if (ocupado) return false;
    return modo === "arquivo" ? arquivo !== null : texto.trim().length > 40;
  }, [ocupado, modo, arquivo, texto]);

  function selecionar(lista: FileList | null) {
    const f = lista?.[0];
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) {
      setErro("Formato não suportado. Envie um PDF ou um DOCX.");
      return;
    }
    setErro(null);
    setArquivo(f);
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    if (!podeEnviar) return;
    setErro(null);

    try {
      let storagePath: string | undefined;
      let nomeArquivo: string | undefined;

      if (modo === "arquivo" && arquivo) {
        setEtapa({ fase: "enviando" });
        storagePath = await enviarArquivo(id, arquivo);
        nomeArquivo = arquivo.name;
      }

      setEtapa({ fase: "extraindo" });
      const resultado = await processarAta({
        empreendimentoId: id,
        storagePath,
        nomeArquivo,
        texto: modo === "texto" ? texto : undefined,
        // `<input type="date">` devolve AAAA-MM-DD; o backend normaliza.
        dataReuniao: dataReuniao || undefined,
      });

      // A detecção de recorrência é uma segunda chamada ao modelo e pode
      // demorar. Mostramos o resultado da extração assim que ele chega e
      // deixamos a recorrência terminar em segundo plano.
      setEtapa({ fase: "recorrencia", resultado });
      try {
        const rec = await detectarRecorrencia(resultado.reuniaoId);
        setEtapa({ fase: "pronto", resultado, vinculos: rec.vinculosCriados });
      } catch {
        // Falhar aqui não invalida a extração: os temas já estão salvos.
        setEtapa({ fase: "pronto", resultado, vinculos: null });
      }
    } catch (e) {
      setErro(mensagemDeErro(e));
      setEtapa({ fase: "parado" });
    }
  }

  if (carregando) return <Carregando />;
  if (!empreendimento) {
    return (
      <Vazio titulo="Empreendimento não encontrado">
        <Link href="/" className="text-marca-700 underline">
          Voltar para a lista
        </Link>
      </Vazio>
    );
  }

  if (etapa.fase === "pronto") {
    return (
      <Sucesso
        empreendimentoId={id}
        resultado={etapa.resultado}
        vinculos={etapa.vinculos}
        onNovaAta={() => {
          setArquivo(null);
          setTexto("");
          setDataReuniao("");
          setEtapa({ fase: "parado" });
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/empreendimentos/${id}`}
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft aria-hidden className="size-4" />
          {empreendimento.nome}
        </Link>
        <TituloSecao descricao="Envie a ata em PDF ou DOCX, ou cole o texto direto. Os temas são extraídos e somados ao histórico do empreendimento.">
          Adicionar reunião
        </TituloSecao>
      </div>

      <Cartao className="p-6">
        <form onSubmit={enviar} className="space-y-6">
          <div className="inline-flex rounded-lg bg-slate-100 p-1">
            <BotaoModo ativo={modo === "arquivo"} onClick={() => setModo("arquivo")} icone={<FileUp className="size-4" />}>
              Enviar arquivo
            </BotaoModo>
            <BotaoModo ativo={modo === "texto"} onClick={() => setModo("texto")} icone={<ClipboardType className="size-4" />}>
              Colar texto
            </BotaoModo>
          </div>

          {modo === "arquivo" ? (
            <div>
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setArrastando(true);
                }}
                onDragLeave={() => setArrastando(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setArrastando(false);
                  selecionar(e.dataTransfer.files);
                }}
                className={clsx(
                  "rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                  arrastando
                    ? "border-marca-500 bg-marca-50"
                    : "border-slate-300 bg-slate-50/50",
                )}
              >
                <Upload aria-hidden className="mx-auto size-8 text-slate-400" />
                <p className="mt-3 text-sm font-medium text-slate-900">
                  Arraste a ata aqui
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  ou{" "}
                  <button
                    type="button"
                    onClick={() => inputArquivo.current?.click()}
                    className="font-medium text-marca-700 underline"
                  >
                    escolha um arquivo
                  </button>
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  PDF (inclusive atas do Autodesk Forma) ou DOCX. Máximo 32 MB para PDF.
                </p>
                <input
                  ref={inputArquivo}
                  type="file"
                  accept={EXTENSOES_ACEITAS}
                  className="hidden"
                  onChange={(e) => selecionar(e.target.files)}
                />
              </div>

              {arquivo ? (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                  <FileUp aria-hidden className="size-4 shrink-0 text-marca-600" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {arquivo.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {(arquivo.size / 1024 / 1024).toFixed(1)} MB
                      {arquivo.size / 1024 / 1024 > AVISO_TAMANHO_MB
                        ? " — arquivo grande, o envio pode demorar"
                        : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setArquivo(null)}
                    aria-label="Remover arquivo"
                    className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X aria-hidden className="size-4" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <Campo
              rotulo="Texto da ata"
              dica="Cole o conteúdo da ata. As seções por disciplina ajudam a extração."
            >
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={14}
                placeholder={"ATA DE REUNIÃO — BRIEFING DE INSTALAÇÕES\nEmpreendimento: …\nData: …\n\nÁgua Fria\n…"}
                className={clsx(CLASSE_INPUT, "font-mono text-xs leading-relaxed")}
              />
            </Campo>
          )}

          <Campo
            rotulo="Data da reunião"
            dica="Opcional. Se ficar em branco, a data é lida do próprio documento; se preenchida, ela prevalece."
          >
            <input
              type="date"
              value={dataReuniao}
              onChange={(e) => setDataReuniao(e.target.value)}
              className={clsx(CLASSE_INPUT, "w-48")}
            />
          </Campo>

          {erro ? <Alerta titulo="Não foi possível processar">{erro}</Alerta> : null}

          {ocupado ? <Progresso etapa={etapa} /> : null}

          <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-5">
            <Botao type="submit" disabled={!podeEnviar}>
              {ocupado ? (
                <Loader2 aria-hidden className="size-4 animate-spin" />
              ) : null}
              Processar ata
            </Botao>
            <Botao
              type="button"
              variante="secundario"
              disabled={ocupado}
              onClick={() => router.push(`/empreendimentos/${id}`)}
            >
              Cancelar
            </Botao>
          </div>
        </form>
      </Cartao>
    </div>
  );
}

function BotaoModo({
  ativo,
  onClick,
  icone,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={clsx(
        "inline-flex items-center gap-2 rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
        ativo ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
      )}
    >
      {icone}
      {children}
    </button>
  );
}

function Progresso({ etapa }: { etapa: Etapa }) {
  const passos = [
    { chave: "enviando", rotulo: "Enviando arquivo" },
    { chave: "extraindo", rotulo: "Extraindo temas com o Claude" },
    { chave: "recorrencia", rotulo: "Procurando temas recorrentes no histórico" },
  ] as const;

  const indiceAtual = passos.findIndex((p) => p.chave === etapa.fase);

  return (
    <ol className="space-y-2 rounded-lg border border-marca-200 bg-marca-50 px-4 py-3">
      {passos.map((p, i) => {
        const concluido = indiceAtual > i;
        const atual = indiceAtual === i;
        return (
          <li key={p.chave} className="flex items-center gap-2.5 text-sm">
            {concluido ? (
              <CheckCircle2 aria-hidden className="size-4 shrink-0 text-emerald-600" />
            ) : atual ? (
              <Loader2 aria-hidden className="size-4 shrink-0 animate-spin text-marca-600" />
            ) : (
              <span aria-hidden className="size-4 shrink-0 rounded-full border-2 border-slate-300" />
            )}
            <span
              className={clsx(
                concluido && "text-slate-500",
                atual && "font-medium text-marca-900",
                !concluido && !atual && "text-slate-400",
              )}
            >
              {p.rotulo}
            </span>
          </li>
        );
      })}
      <li className="pt-1 text-xs text-marca-800">
        Atas longas podem levar alguns minutos. Não feche esta página.
      </li>
    </ol>
  );
}

function Sucesso({
  empreendimentoId,
  resultado,
  vinculos,
  onNovaAta,
}: {
  empreendimentoId: string;
  resultado: RespostaProcessarAta;
  vinculos: number | null;
  onNovaAta: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl">
      <Cartao className="p-8 text-center">
        <CheckCircle2 aria-hidden className="mx-auto size-10 text-emerald-600" />
        <h2 className="mt-4 text-lg font-semibold text-slate-900">
          Ata processada
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          <strong className="text-slate-900">{resultado.totalTemas}</strong>{" "}
          tema{resultado.totalTemas === 1 ? "" : "s"} extraído
          {resultado.totalTemas === 1 ? "" : "s"}
          {resultado.dataReuniao ? ` da reunião de ${resultado.dataReuniao}` : ""}.
        </p>
        <p className="mt-1 text-sm text-slate-600">
          {vinculos === null
            ? "A detecção de recorrência não concluiu; você pode reprocessá-la depois no painel."
            : vinculos === 0
              ? "Nenhum tema recorrente novo foi identificado no histórico."
              : `${vinculos} vínculo(s) de tema recorrente identificado(s).`}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <BotaoLink href={`/empreendimentos/${empreendimentoId}`}>
            Ver painel do empreendimento
          </BotaoLink>
          <Botao variante="secundario" onClick={onNovaAta}>
            Adicionar outra ata
          </Botao>
        </div>
      </Cartao>
    </div>
  );
}
