import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELO } from "./anthropic";
import { Disciplina } from "../domain";

const NOME_TOOL = "registrar_recorrencias";

/** Forma reduzida de um tema, suficiente para o modelo julgar equivalência. */
export interface TemaComparavel {
  id: string;
  empreendimentoNome: string;
  dataReuniao: string;
  tema: string;
  contexto: string;
  solucao: string;
}

/** Um par de temas que o modelo considerou o mesmo assunto. */
export interface ParRecorrente {
  idNovo: string;
  idExistente: string;
}

const TOOL_RECORRENCIA: Anthropic.Tool = {
  name: NOME_TOOL,
  description:
    "Registra quais temas novos tratam do mesmo assunto que temas já existentes no histórico",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      pares: {
        type: "array",
        description:
          "Um item por par (tema novo, tema existente) que trata do mesmo assunto. Lista vazia se não houver nenhum.",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            idNovo: { type: "string", description: "ID do tema da lista NOVOS" },
            idExistente: {
              type: "string",
              description: "ID do tema da lista HISTÓRICO",
            },
            justificativa: {
              type: "string",
              description: "Uma frase curta explicando por que são o mesmo assunto",
            },
          },
          required: ["idNovo", "idExistente", "justificativa"],
        },
      },
    },
    required: ["pares"],
  },
};

const SYSTEM_PROMPT = `Você compara temas discutidos em reuniões de briefing de instalações prediais da MRV e identifica quais tratam do **mesmo assunto recorrente**, mesmo quando a redação é diferente.

Você recebe duas listas de temas da mesma disciplina: NOVOS (recém-extraídos) e HISTÓRICO (já no banco, de outras reuniões e possivelmente de outros empreendimentos). Para cada tema de NOVOS, aponte os temas de HISTÓRICO que tratam do mesmo assunto.

O que conta como o mesmo assunto:
- Mesma questão técnica, com redação diferente. Ex.: "otimizar caixa de gordura" e "reduzir quantidade de caixas de gordura" são o mesmo tema recorrente.
- Mesmo problema recorrendo em empreendimentos diferentes — isso é justamente o que interessa detectar.
- O mesmo assunto retomado numa reunião seguinte do mesmo empreendimento, mesmo que agora esteja resolvido.

O que **não** conta:
- Estarem na mesma disciplina. Todos os temas que você recebe já são da mesma disciplina; isso sozinho não é recorrência.
- Serem genericamente parecidos ("ajuste de projeto", "compatibilização") sem tratarem do mesmo item concreto.
- Tratarem de elementos diferentes do mesmo sistema (ex.: prumada de água fria x reservatório superior são assuntos distintos).

Seja conservador: na dúvida, não relacione. Um falso positivo polui o painel de recorrentes e custa mais caro que um falso negativo.

Use exclusivamente os IDs fornecidos. Chame ${NOME_TOOL} uma única vez, mesmo que não haja nenhum par.`;

function renderar(temas: TemaComparavel[]): string {
  return temas
    .map(
      (t) =>
        `- id: ${t.id}\n  empreendimento: ${t.empreendimentoNome}\n  data: ${t.dataReuniao}\n  tema: ${t.tema}\n  contexto: ${t.contexto}\n  solução: ${t.solucao}`,
    )
    .join("\n");
}

/**
 * Compara um lote de temas novos contra o histórico da mesma disciplina.
 *
 * Devolve apenas pares cujos dois IDs pertencem de fato às listas enviadas —
 * o modelo não tem como inventar um ID válido, mas validar é barato e evita
 * gravar referência para documento inexistente.
 */
export async function compararLote(
  disciplina: Disciplina,
  novos: TemaComparavel[],
  historico: TemaComparavel[],
): Promise<ParRecorrente[]> {
  if (novos.length === 0 || historico.length === 0) return [];

  const client = getAnthropic();

  const stream = client.messages.stream({
    model: MODELO,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    tools: [TOOL_RECORRENCIA],
    tool_choice: { type: "tool", name: NOME_TOOL },
    messages: [
      {
        role: "user",
        content: `Disciplina: ${disciplina}

NOVOS:
${renderar(novos)}

HISTÓRICO:
${renderar(historico)}`,
      },
    ],
  });

  const message = await stream.finalMessage();
  const bloco = message.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === NOME_TOOL,
  );
  if (!bloco) return [];

  const idsNovos = new Set(novos.map((t) => t.id));
  const idsHistorico = new Set(historico.map((t) => t.id));

  const pares = (bloco.input as { pares?: unknown }).pares;
  if (!Array.isArray(pares)) return [];

  const validos: ParRecorrente[] = [];
  const vistos = new Set<string>();
  for (const par of pares) {
    if (typeof par !== "object" || par === null) continue;
    const { idNovo, idExistente } = par as Record<string, unknown>;
    if (typeof idNovo !== "string" || typeof idExistente !== "string") continue;
    if (idNovo === idExistente) continue;
    if (!idsNovos.has(idNovo) || !idsHistorico.has(idExistente)) continue;
    const chave = `${idNovo}::${idExistente}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    validos.push({ idNovo, idExistente });
  }
  return validos;
}

/**
 * Converte os pares numa tabela `id -> ids relacionados`, simétrica: se A é
 * recorrência de B, B também referencia A. É essa tabela que o handler grava
 * em `temaRecorrenteDe`.
 */
export function construirVinculos(
  pares: ParRecorrente[],
): Map<string, Set<string>> {
  const vinculos = new Map<string, Set<string>>();
  const adicionar = (de: string, para: string) => {
    let destino = vinculos.get(de);
    if (!destino) {
      destino = new Set<string>();
      vinculos.set(de, destino);
    }
    destino.add(para);
  };
  for (const { idNovo, idExistente } of pares) {
    adicionar(idNovo, idExistente);
    adicionar(idExistente, idNovo);
  }
  return vinculos;
}
