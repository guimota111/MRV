import { FieldValue } from "firebase-admin/firestore";
import { onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { ANTHROPIC_API_KEY, OPCOES_PESADAS } from "../config";
import { Disciplina, isDisciplina } from "../domain";
import { COL_TEMAS, LIMITE_BATCH, db, emBlocos } from "../lib/firestore";
import {
  ParRecorrente,
  TemaComparavel,
  compararLote,
  construirVinculos,
} from "../lib/recorrencia";

/**
 * Teto de temas do histórico enviados por disciplina numa comparação.
 * Protege contra um prompt gigante quando o banco crescer; os mais recentes
 * são os que interessam. Se o corte acontecer, fica registrado no log.
 */
const MAX_HISTORICO_POR_DISCIPLINA = 150;

/** Quantos temas novos vão em cada chamada ao modelo. */
const TAMANHO_LOTE_NOVOS = 25;

interface EntradaDetectar {
  /** Compara só os temas desta reunião. Sem ela, reprocessa o banco inteiro. */
  reuniaoId?: unknown;
}

function paraComparavel(
  doc: FirebaseFirestore.QueryDocumentSnapshot,
): TemaComparavel {
  return {
    id: doc.id,
    empreendimentoNome: (doc.get("empreendimentoNome") as string) ?? "",
    dataReuniao: (doc.get("dataReuniao") as string) ?? "",
    tema: (doc.get("tema") as string) ?? "",
    contexto: (doc.get("contexto") as string) ?? "",
    solucao: (doc.get("solucao") as string) ?? "",
  };
}

/**
 * Compara os temas de uma reunião com todo o histórico da mesma disciplina
 * (de qualquer empreendimento) e grava os vínculos em `temaRecorrenteDe`.
 *
 * Roda depois de `processarAta`, chamada pelo client sem `await` — o
 * dashboard escuta o Firestore e atualiza sozinho quando os vínculos chegam.
 */
export const detectarRecorrencia = onCall(
  { ...OPCOES_PESADAS, secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    const dados = (request.data ?? {}) as EntradaDetectar;
    const reuniaoId =
      typeof dados.reuniaoId === "string" && dados.reuniaoId.trim() !== ""
        ? dados.reuniaoId.trim()
        : undefined;

    // Temas a comparar (os "novos").
    const novosSnap = reuniaoId
      ? await db.collection(COL_TEMAS).where("reuniaoId", "==", reuniaoId).get()
      : await db.collection(COL_TEMAS).get();

    if (novosSnap.empty) {
      return { comparados: 0, vinculosCriados: 0, disciplinas: [] };
    }

    // Agrupa por disciplina: só faz sentido comparar temas da mesma disciplina.
    const novosPorDisciplina = new Map<Disciplina, TemaComparavel[]>();
    for (const doc of novosSnap.docs) {
      const disciplina = doc.get("disciplina");
      if (!isDisciplina(disciplina)) continue;
      const lista = novosPorDisciplina.get(disciplina);
      if (lista) lista.push(paraComparavel(doc));
      else novosPorDisciplina.set(disciplina, [paraComparavel(doc)]);
    }

    const todosPares: ParRecorrente[] = [];
    const disciplinasProcessadas: string[] = [];

    for (const [disciplina, novos] of novosPorDisciplina) {
      // Histórico = todos os temas da disciplina que não estão no lote novo.
      const historicoSnap = await db
        .collection(COL_TEMAS)
        .where("disciplina", "==", disciplina)
        .get();

      const idsNovos = new Set(novos.map((t) => t.id));
      let historico = historicoSnap.docs
        .filter((d) => !idsNovos.has(d.id))
        .map(paraComparavel);

      if (historico.length === 0) continue;

      if (historico.length > MAX_HISTORICO_POR_DISCIPLINA) {
        logger.warn("Histórico truncado na detecção de recorrência", {
          disciplina,
          total: historico.length,
          usados: MAX_HISTORICO_POR_DISCIPLINA,
        });
        historico = historico.slice(-MAX_HISTORICO_POR_DISCIPLINA);
      }

      for (const lote of emBlocos(novos, TAMANHO_LOTE_NOVOS)) {
        try {
          const pares = await compararLote(disciplina, lote, historico);
          todosPares.push(...pares);
        } catch (erro) {
          // Uma disciplina que falha não deve derrubar as outras.
          logger.error("Falha ao comparar lote", {
            disciplina,
            erro: erro instanceof Error ? erro.message : String(erro),
          });
        }
      }
      disciplinasProcessadas.push(disciplina);
    }

    const vinculos = construirVinculos(todosPares);
    await gravarVinculos(vinculos);

    logger.info("Detecção de recorrência concluída", {
      reuniaoId: reuniaoId ?? "(todos)",
      comparados: novosSnap.size,
      pares: todosPares.length,
    });

    return {
      comparados: novosSnap.size,
      vinculosCriados: todosPares.length,
      disciplinas: disciplinasProcessadas,
    };
  },
);

/**
 * Grava os vínculos com `arrayUnion`, que é idempotente: reprocessar a mesma
 * reunião não duplica IDs nem apaga vínculos criados por outras execuções.
 */
async function gravarVinculos(vinculos: Map<string, Set<string>>) {
  const entradas = [...vinculos.entries()];
  for (const bloco of emBlocos(entradas, LIMITE_BATCH)) {
    const batch = db.batch();
    for (const [id, relacionados] of bloco) {
      batch.update(db.collection(COL_TEMAS).doc(id), {
        temaRecorrenteDe: FieldValue.arrayUnion(...relacionados),
      });
    }
    await batch.commit();
  }
}

