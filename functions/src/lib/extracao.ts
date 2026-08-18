import Anthropic from "@anthropic-ai/sdk";
import { getAnthropic, MODELO } from "./anthropic";
import {
  DISCIPLINAS,
  Disciplina,
  NAO_INFORMADO,
  ResultadoExtracao,
  STATUS_TEMA,
  StatusTema,
  TemaExtraido,
  isDisciplina,
  isStatusTema,
} from "../domain";

const NOME_TOOL = "extract_temas";

/**
 * Schema do tool de extração.
 *
 * Deliberadamente **sem** `strict: true`. Os enums de disciplina têm valores
 * acentuados e de várias palavras ("Água Fria", "Entrada de Energia"); com
 * `strict` ligado, a gramática restrita que a API compila a partir desses
 * enums faz a geração degenerar quando a ata é um PDF — o modelo devolve um
 * único tema preenchido com "placeholder" em vez da extração real. É
 * reproduzível: mesmo prompt e mesmo PDF, sem `strict`, devolvem a extração
 * completa e correta.
 *
 * Os enums continuam no schema porque orientam o modelo a usar a grafia exata
 * das disciplinas; a validação fica por conta de `normalizarTemas`.
 */
const TOOL_EXTRACAO: Anthropic.Tool = {
  name: NOME_TOOL,
  description:
    "Extrai os temas discutidos em uma ata/transcrição de reunião de briefing de instalações",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      dataReuniao: {
        type: "string",
        description:
          "Data da reunião no formato DD/MM/AAAA, se identificável no documento. String vazia se não houver data no documento.",
      },
      temas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            disciplina: { type: "string", enum: [...DISCIPLINAS] },
            tema: {
              type: "string",
              description: "Título curto do assunto, no máximo ~10 palavras",
            },
            contexto: {
              type: "string",
              description: "O que foi discutido / problema identificado",
            },
            solucao: {
              type: "string",
              description: "Encaminhamento / decisão tomada",
            },
            responsavel: {
              type: "string",
              description: `Nome ou área responsável. "${NAO_INFORMADO}" se não mencionado.`,
            },
            prazo: {
              type: "string",
              description: `Prazo acordado. "${NAO_INFORMADO}" se não mencionado.`,
            },
            status: { type: "string", enum: [...STATUS_TEMA] },
          },
          required: [
            "disciplina",
            "tema",
            "contexto",
            "solucao",
            "responsavel",
            "prazo",
            "status",
          ],
        },
      },
    },
    required: ["dataReuniao", "temas"],
  },
};

const SYSTEM_PROMPT = `Você extrai temas discutidos de atas de reuniões de briefing de instalações prediais da MRV Engenharia (água fria, esgoto, drenagem, elétrico, comunicações, aterramento, incêndio, entrada de energia, iluminação).

As atas chegam em dois formatos:

1. **Atas do Autodesk Forma** — já estruturadas por disciplina, em tabela, com itens de discussão numerados, um status por item ("Aberto"/"Fechado") e às vezes data de fechamento.
2. **Atas manuais** — texto corrido, organizado em seções por disciplina, sem status explícito e sem tabela.

Regras de extração:

- **Granularidade.** Cada item de discussão de uma ata estruturada (Forma) vira um tema separado. Não agrupe itens diferentes da mesma disciplina num único tema, a menos que sejam claramente o mesmo assunto. Numa ata manual, divida cada seção de disciplina em temas por parágrafo ou ideia distinta.
- **Status.** Item marcado "Fechado" numa ata do Forma vira "Resolvido". Item "Aberto" vira "Em andamento" se há indicação de que o assunto está sendo trabalhado (alguém ficou de verificar, estudo em curso, aguardando retorno de alguém identificado), ou "Pendente" se apenas foi levantado e não há indicação de andamento. Em atas manuais, infira o status pelo texto com o mesmo critério: decisão tomada e fechada = "Resolvido"; encaminhamento em curso = "Em andamento"; assunto levantado sem encaminhamento = "Pendente".
- **Não invente.** Se responsável ou prazo não estiverem explícitos no texto, use exatamente "${NAO_INFORMADO}". Nunca deduza um nome de responsável a partir de quem estava presente na reunião.
- **Disciplina.** Use a seção/disciplina em que o item aparece no documento. Só use "Outro" quando o assunto realmente não pertencer a nenhuma das disciplinas listadas (ex.: pauta administrativa, próximos passos gerais).
- **Fidelidade.** \`contexto\` e \`solucao\` devem refletir o que está escrito, em português, de forma concisa mas completa. Preserve números, bitolas, diâmetros, cotas e referências normativas mencionados. Se um item não tem solução/encaminhamento registrado, use "${NAO_INFORMADO}" em \`solucao\`.
- **Croquis e imagens.** Legendas, anotações e textos dentro de croquis/plantas fazem parte da ata — extraia o que estiver legível neles.

Chame a ferramenta ${NOME_TOOL} uma única vez com todos os temas encontrados.`;

/** Entrada da extração: um PDF, ou texto já extraído (DOCX ou colado). */
export type FonteExtracao =
  | { tipo: "pdf"; base64: string; nomeArquivo?: string }
  | { tipo: "texto"; texto: string; nomeArquivo?: string };

function montarConteudo(
  fonte: FonteExtracao,
): Anthropic.ContentBlockParam[] {
  const instrucao: Anthropic.ContentBlockParam = {
    type: "text",
    text: "Extraia todos os temas discutidos nesta ata de reunião de briefing de instalações.",
  };

  if (fonte.tipo === "pdf") {
    // O documento vem antes do texto: a API recomenda essa ordem para
    // que o modelo leia o anexo como contexto da instrução.
    return [
      {
        type: "document",
        source: {
          type: "base64",
          media_type: "application/pdf",
          data: fonte.base64,
        },
        title: fonte.nomeArquivo,
      },
      instrucao,
    ];
  }

  return [
    { type: "text", text: `<ata>\n${fonte.texto}\n</ata>` },
    instrucao,
  ];
}

/** Minúsculas e sem acento, para comparar valores de enum com tolerância. */
function achatar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

const DISCIPLINAS_ACHATADAS = new Map(
  DISCIPLINAS.map((d) => [achatar(d), d] as const),
);

const STATUS_ACHATADOS = new Map(
  STATUS_TEMA.map((s) => [achatar(s), s] as const),
);

/** Devolve a disciplina canônica; "Outro" quando não reconhece. */
export function casarDisciplina(valor: unknown): Disciplina {
  if (isDisciplina(valor)) return valor;
  if (typeof valor !== "string") return "Outro";
  return DISCIPLINAS_ACHATADAS.get(achatar(valor)) ?? "Outro";
}

/**
 * Devolve o status canônico. Também aceita os rótulos crus do Forma:
 * "Fechado" vira "Resolvido" e "Aberto" vira "Pendente" — rede de segurança
 * caso o modelo devolva o rótulo do documento em vez do valor do enum.
 */
export function casarStatus(valor: unknown): StatusTema {
  if (isStatusTema(valor)) return valor;
  if (typeof valor !== "string") return "Pendente";
  const chave = achatar(valor);
  const direto = STATUS_ACHATADOS.get(chave);
  if (direto) return direto;
  if (chave === "fechado" || chave === "concluido" || chave === "resolvido") {
    return "Resolvido";
  }
  if (chave === "aberto") return "Pendente";
  return "Pendente";
}

/**
 * Valida e normaliza o que veio da API.
 *
 * Como o schema não usa `strict`, esta é a única garantia de formato: cada
 * campo é aparado, campos vazios viram "-" (o que dashboard e Excel esperam) e
 * disciplina/status passam por uma comparação tolerante a acento e caixa,
 * porque o modelo às vezes devolve "Água fria" em vez de "Água Fria".
 */
export function normalizarTemas(brutos: unknown): TemaExtraido[] {
  if (!Array.isArray(brutos)) return [];
  const temas: TemaExtraido[] = [];
  for (const bruto of brutos) {
    if (typeof bruto !== "object" || bruto === null) continue;
    const t = bruto as Record<string, unknown>;
    const texto = (v: unknown, padrao = ""): string => {
      const s = typeof v === "string" ? v.trim() : "";
      return s === "" ? padrao : s;
    };
    const tema = texto(t.tema);
    // Um tema sem título não é aproveitável em nenhuma tela — descarta.
    if (!tema) continue;
    temas.push({
      disciplina: casarDisciplina(t.disciplina),
      tema,
      contexto: texto(t.contexto, NAO_INFORMADO),
      solucao: texto(t.solucao, NAO_INFORMADO),
      responsavel: texto(t.responsavel, NAO_INFORMADO),
      prazo: texto(t.prazo, NAO_INFORMADO),
      status: casarStatus(t.status),
    });
  }
  return temas;
}

/** Aceita DD/MM/AAAA e alguns formatos vizinhos; devolve "" se não reconhecer. */
export function normalizarData(valor: unknown): string {
  if (typeof valor !== "string") return "";
  const s = valor.trim();
  if (!s) return "";
  const barra = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (barra) {
    const [, d, m, a] = barra;
    const ano = a.length === 2 ? `20${a}` : a;
    return `${d.padStart(2, "0")}/${m.padStart(2, "0")}/${ano}`;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const [, a, m, d] = iso;
    return `${d}/${m}/${a}`;
  }
  return "";
}

/**
 * Chama o Claude com tool use forçado e devolve os temas estruturados.
 *
 * Usa streaming porque uma ata longa do Forma pode render dezenas de temas —
 * com `max_tokens` alto, requisições não-streaming esbarram no timeout HTTP.
 */
export async function extrairTemas(
  fonte: FonteExtracao,
): Promise<ResultadoExtracao> {
  const client = getAnthropic();

  const stream = client.messages.stream({
    model: MODELO,
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    tools: [TOOL_EXTRACAO],
    tool_choice: { type: "tool", name: NOME_TOOL },
    messages: [{ role: "user", content: montarConteudo(fonte) }],
  });

  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error(
      "A API recusou processar este documento por motivos de segurança.",
    );
  }

  const bloco = message.content.find(
    (b): b is Anthropic.ToolUseBlock =>
      b.type === "tool_use" && b.name === NOME_TOOL,
  );

  if (!bloco) {
    throw new Error(
      `O modelo não retornou a extração estruturada (stop_reason: ${message.stop_reason}).`,
    );
  }

  const input = bloco.input as Record<string, unknown>;
  const temas = normalizarTemas(input.temas);

  if (message.stop_reason === "max_tokens") {
    // A extração foi cortada no meio; o que chegou vale, mas o chamador
    // precisa saber que pode estar incompleta.
    throw Object.assign(
      new Error(
        "A extração excedeu o limite de tokens e pode estar incompleta. Divida a ata em partes menores.",
      ),
      { temasParciais: temas },
    );
  }

  return { dataReuniao: normalizarData(input.dataReuniao), temas };
}
