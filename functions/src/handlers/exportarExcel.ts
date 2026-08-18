import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { OPCOES_HTTP } from "../config";
import { Tema } from "../domain";
import { COL_EMPREENDIMENTOS, COL_TEMAS, db } from "../lib/firestore";
import { gerarWorkbook, nomeArquivoExport } from "../lib/excel";

function paraTema(doc: FirebaseFirestore.QueryDocumentSnapshot): Tema {
  const d = doc.data();
  return {
    id: doc.id,
    empreendimentoId: d.empreendimentoId ?? "",
    empreendimentoNome: d.empreendimentoNome ?? "",
    reuniaoId: d.reuniaoId ?? "",
    dataReuniao: d.dataReuniao ?? "",
    disciplina: d.disciplina ?? "Outro",
    tema: d.tema ?? "",
    contexto: d.contexto ?? "-",
    solucao: d.solucao ?? "-",
    responsavel: d.responsavel ?? "-",
    prazo: d.prazo ?? "-",
    status: d.status ?? "Pendente",
    temaRecorrenteDe: Array.isArray(d.temaRecorrenteDe) ? d.temaRecorrenteDe : [],
  };
}

/** DD/MM/AAAA → AAAA-MM-DD, para ordenação lexicográfica. */
function ordenavel(data: string): string {
  const m = data.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "9999-99-99";
}

/** Empreendimento, depois data (mais antiga primeiro), depois disciplina. */
function ordenarParaPlanilha(a: Tema, b: Tema): number {
  const porNome = a.empreendimentoNome.localeCompare(
    b.empreendimentoNome,
    "pt-BR",
  );
  if (porNome !== 0) return porNome;
  const porData = ordenavel(a.dataReuniao).localeCompare(
    ordenavel(b.dataReuniao),
  );
  if (porData !== 0) return porData;
  return a.disciplina.localeCompare(b.disciplina, "pt-BR");
}

/**
 * Gera o .xlsx sob demanda a partir do Firestore.
 *
 * É uma function HTTP (e não callable) para que o botão "Exportar" possa
 * apontar direto para a URL e o navegador cuidar do download.
 *
 *   GET /exportarExcel                       → todos os empreendimentos
 *   GET /exportarExcel?empreendimentoId=abc  → apenas um empreendimento
 */
export const exportarExcel = onRequest(OPCOES_HTTP, async (req, res) => {
  try {
    const empreendimentoId =
      typeof req.query.empreendimentoId === "string" &&
      req.query.empreendimentoId.trim() !== ""
        ? req.query.empreendimentoId.trim()
        : undefined;

    let escopo = "geral";
    if (empreendimentoId) {
      const snap = await db
        .collection(COL_EMPREENDIMENTOS)
        .doc(empreendimentoId)
        .get();
      if (!snap.exists) {
        res.status(404).json({ erro: "Empreendimento não encontrado." });
        return;
      }
      escopo = (snap.get("nome") as string | undefined) ?? empreendimentoId;
    }

    const query = empreendimentoId
      ? db
          .collection(COL_TEMAS)
          .where("empreendimentoId", "==", empreendimentoId)
      : db.collection(COL_TEMAS);
    const snap = await query.get();

    const temas = snap.docs.map(paraTema).sort(ordenarParaPlanilha);
    const buffer = await gerarWorkbook(temas);
    const nomeArquivo = nomeArquivoExport(escopo);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
    res.setHeader("Content-Length", String(buffer.byteLength));
    res.status(200).send(buffer);
  } catch (erro) {
    logger.error("Falha ao exportar Excel", {
      erro: erro instanceof Error ? erro.message : String(erro),
    });
    res.status(500).json({ erro: "Não foi possível gerar a planilha." });
  }
});
