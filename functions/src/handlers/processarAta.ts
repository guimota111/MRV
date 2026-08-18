import { FieldValue } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { ANTHROPIC_API_KEY, BUCKET_ATAS, OPCOES_PESADAS } from "../config";
import { NAO_INFORMADO, TemaExtraido, TipoFonte } from "../domain";
import {
  COL_EMPREENDIMENTOS,
  COL_REUNIOES,
  COL_TEMAS,
  LIMITE_BATCH,
  db,
  emBlocos,
  storage,
} from "../lib/firestore";
import {
  LIMITE_PDF_BYTES,
  detectarTipo,
  extrairTextoDocx,
} from "../lib/documento";
import { FonteExtracao, extrairTemas, normalizarData } from "../lib/extracao";

interface EntradaProcessarAta {
  empreendimentoId?: unknown;
  /** Caminho no Storage do arquivo já enviado pelo client (PDF ou DOCX). */
  storagePath?: unknown;
  nomeArquivo?: unknown;
  /** Texto colado direto, alternativa ao upload. */
  texto?: unknown;
  /** Data informada manualmente; tem prioridade sobre a detectada no documento. */
  dataReuniao?: unknown;
}

function exigirString(valor: unknown, campo: string): string {
  if (typeof valor !== "string" || valor.trim() === "") {
    throw new HttpsError("invalid-argument", `Campo obrigatório: ${campo}.`);
  }
  return valor.trim();
}

/**
 * Recebe uma ata (arquivo no Storage ou texto colado), extrai os temas via
 * Claude e grava reunião + temas no Firestore.
 *
 * O arquivo já chega no Storage: o client faz o upload direto, o que evita o
 * limite de payload das callable functions — as atas manuais em DOCX passam
 * facilmente de 10 MB por causa dos screenshots incorporados.
 */
export const processarAta = onCall(
  { ...OPCOES_PESADAS, secrets: [ANTHROPIC_API_KEY] },
  async (request) => {
    const dados = (request.data ?? {}) as EntradaProcessarAta;
    const empreendimentoId = exigirString(
      dados.empreendimentoId,
      "empreendimentoId",
    );

    const empreendimentoRef = db
      .collection(COL_EMPREENDIMENTOS)
      .doc(empreendimentoId);
    const empreendimentoSnap = await empreendimentoRef.get();
    if (!empreendimentoSnap.exists) {
      throw new HttpsError("not-found", "Empreendimento não encontrado.");
    }
    const empreendimentoNome =
      (empreendimentoSnap.get("nome") as string | undefined) ?? "Sem nome";

    const storagePath =
      typeof dados.storagePath === "string" && dados.storagePath.trim() !== ""
        ? dados.storagePath.trim()
        : undefined;
    const textoColado =
      typeof dados.texto === "string" && dados.texto.trim() !== ""
        ? dados.texto.trim()
        : undefined;

    if (!storagePath && !textoColado) {
      throw new HttpsError(
        "invalid-argument",
        "Envie um arquivo (storagePath) ou cole o texto da ata (texto).",
      );
    }

    const nomeArquivo =
      typeof dados.nomeArquivo === "string" && dados.nomeArquivo.trim() !== ""
        ? dados.nomeArquivo.trim()
        : undefined;

    // Cria a reunião já em "processando" para que a UI mostre o andamento.
    const reuniaoRef = empreendimentoRef.collection(COL_REUNIOES).doc();
    let tipoFonte: TipoFonte = textoColado ? "texto_colado" : "manual";

    await reuniaoRef.set({
      data: normalizarData(dados.dataReuniao) || "",
      tipoFonte,
      nomeArquivoOriginal: nomeArquivo ?? null,
      arquivoOriginalUrl: null,
      status: "processando",
      processadoEm: null,
      createdAt: FieldValue.serverTimestamp(),
    });

    try {
      let fonte: FonteExtracao;

      if (storagePath) {
        const nomeParaTipo = nomeArquivo ?? storagePath;
        const tipo = detectarTipo(nomeParaTipo);
        if (!tipo) {
          throw new HttpsError(
            "invalid-argument",
            "Formato não suportado. Envie um PDF ou um DOCX.",
          );
        }

        const arquivo = storage.bucket(BUCKET_ATAS).file(storagePath);
        const [existe] = await arquivo.exists();
        if (!existe) {
          throw new HttpsError(
            "not-found",
            "Arquivo não encontrado no Storage. Refaça o upload.",
          );
        }
        const [buffer] = await arquivo.download();

        if (tipo === "pdf") {
          if (buffer.byteLength > LIMITE_PDF_BYTES) {
            throw new HttpsError(
              "invalid-argument",
              `PDF de ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB excede o limite de 32 MB da API. Divida o arquivo.`,
            );
          }
          // PDF vai inteiro para a API: ela lê o texto e também o que está
          // escrito dentro de croquis e imagens.
          fonte = {
            tipo: "pdf",
            base64: buffer.toString("base64"),
            nomeArquivo,
          };
          // Ata do Forma é sempre PDF; a distinção fina entre "forma" e
          // "manual" é feita abaixo, pelo conteúdo extraído.
          tipoFonte = "forma";
        } else {
          const texto = await extrairTextoDocx(buffer);
          if (texto.length < 40) {
            throw new HttpsError(
              "invalid-argument",
              "Não foi possível extrair texto deste DOCX. Ele pode conter apenas imagens — exporte como PDF e envie novamente.",
            );
          }
          fonte = { tipo: "texto", texto, nomeArquivo };
          tipoFonte = "manual";
        }

        // URL de leitura para auditoria. Assinada por 10 anos porque não há
        // auth nesta fase; ao adicionar Firebase Auth, trocar por download
        // autenticado via SDK do client.
        const [url] = await arquivo.getSignedUrl({
          action: "read",
          expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
        });
        await reuniaoRef.update({ arquivoOriginalUrl: url, tipoFonte });
      } else {
        fonte = { tipo: "texto", texto: textoColado as string };
        tipoFonte = "texto_colado";
      }

      const resultado = await extrairTemas(fonte);

      if (resultado.temas.length === 0) {
        throw new HttpsError(
          "failed-precondition",
          "Nenhum tema foi identificado neste documento. Verifique se é mesmo uma ata de briefing.",
        );
      }

      // Data informada manualmente vence a detectada no documento.
      const dataReuniao =
        normalizarData(dados.dataReuniao) ||
        normalizarData(resultado.dataReuniao) ||
        "";

      await gravarTemas({
        empreendimentoId,
        empreendimentoNome,
        reuniaoId: reuniaoRef.id,
        dataReuniao,
        temas: resultado.temas,
      });

      await reuniaoRef.update({
        data: dataReuniao,
        tipoFonte,
        status: "concluido",
        totalTemas: resultado.temas.length,
        processadoEm: FieldValue.serverTimestamp(),
        erro: FieldValue.delete(),
      });

      logger.info("Ata processada", {
        empreendimentoId,
        reuniaoId: reuniaoRef.id,
        totalTemas: resultado.temas.length,
        tipoFonte,
      });

      return {
        reuniaoId: reuniaoRef.id,
        totalTemas: resultado.temas.length,
        dataReuniao,
        tipoFonte,
      };
    } catch (erro) {
      const mensagem =
        erro instanceof HttpsError
          ? erro.message
          : erro instanceof Error
            ? erro.message
            : "Erro desconhecido ao processar a ata.";

      logger.error("Falha ao processar ata", {
        empreendimentoId,
        reuniaoId: reuniaoRef.id,
        erro: mensagem,
      });

      await reuniaoRef.update({
        status: "erro",
        erro: mensagem,
        processadoEm: FieldValue.serverTimestamp(),
      });

      if (erro instanceof HttpsError) throw erro;
      throw new HttpsError("internal", mensagem);
    }
  },
);

async function gravarTemas(args: {
  empreendimentoId: string;
  empreendimentoNome: string;
  reuniaoId: string;
  dataReuniao: string;
  temas: TemaExtraido[];
}) {
  const colecao = db.collection(COL_TEMAS);
  for (const bloco of emBlocos(args.temas, LIMITE_BATCH)) {
    const batch = db.batch();
    for (const tema of bloco) {
      batch.set(colecao.doc(), {
        empreendimentoId: args.empreendimentoId,
        empreendimentoNome: args.empreendimentoNome,
        reuniaoId: args.reuniaoId,
        dataReuniao: args.dataReuniao,
        disciplina: tema.disciplina,
        tema: tema.tema,
        contexto: tema.contexto || NAO_INFORMADO,
        solucao: tema.solucao || NAO_INFORMADO,
        responsavel: tema.responsavel || NAO_INFORMADO,
        prazo: tema.prazo || NAO_INFORMADO,
        status: tema.status,
        temaRecorrenteDe: [],
        createdAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
  }
}

