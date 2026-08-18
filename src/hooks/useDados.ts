"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DocumentData,
  QueryDocumentSnapshot,
  Timestamp,
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db, firebaseConfigurado } from "@/lib/firebase";
import {
  Disciplina,
  Empreendimento,
  Reuniao,
  StatusReuniao,
  StatusTema,
  Tema,
  TipoFonte,
} from "@/lib/domain";

const MSG_SEM_CONFIG =
  "Firebase não configurado. Copie .env.example para .env.local e preencha as chaves do projeto.";

interface Estado<T> {
  dados: T;
  carregando: boolean;
  erro: string | null;
}

function paraMillis(valor: unknown): number | null {
  return valor instanceof Timestamp ? valor.toMillis() : null;
}

function paraEmpreendimento(d: QueryDocumentSnapshot<DocumentData>): Empreendimento {
  const dados = d.data();
  return {
    id: d.id,
    nome: (dados.nome as string) ?? "Sem nome",
    localizacao: (dados.localizacao as string) ?? "",
    createdAt: paraMillis(dados.createdAt),
  };
}

function paraReuniao(d: QueryDocumentSnapshot<DocumentData>): Reuniao {
  const dados = d.data();
  return {
    id: d.id,
    data: (dados.data as string) ?? "",
    tipoFonte: (dados.tipoFonte as TipoFonte) ?? "manual",
    arquivoOriginalUrl: (dados.arquivoOriginalUrl as string) ?? null,
    nomeArquivoOriginal: (dados.nomeArquivoOriginal as string) ?? null,
    status: (dados.status as StatusReuniao) ?? "concluido",
    erro: (dados.erro as string) ?? null,
    totalTemas: (dados.totalTemas as number) ?? 0,
    processadoEm: paraMillis(dados.processadoEm),
  };
}

function paraTema(d: QueryDocumentSnapshot<DocumentData>): Tema {
  const dados = d.data();
  return {
    id: d.id,
    empreendimentoId: (dados.empreendimentoId as string) ?? "",
    empreendimentoNome: (dados.empreendimentoNome as string) ?? "",
    reuniaoId: (dados.reuniaoId as string) ?? "",
    dataReuniao: (dados.dataReuniao as string) ?? "",
    disciplina: (dados.disciplina as Disciplina) ?? "Outro",
    tema: (dados.tema as string) ?? "",
    contexto: (dados.contexto as string) ?? "-",
    solucao: (dados.solucao as string) ?? "-",
    responsavel: (dados.responsavel as string) ?? "-",
    prazo: (dados.prazo as string) ?? "-",
    status: (dados.status as StatusTema) ?? "Pendente",
    temaRecorrenteDe: Array.isArray(dados.temaRecorrenteDe)
      ? (dados.temaRecorrenteDe as string[])
      : [],
  };
}

/**
 * Assina uma coleção em tempo real.
 *
 * É `onSnapshot` (e não uma leitura única) de propósito: a detecção de
 * recorrência roda em background e o dashboard precisa se atualizar sozinho
 * quando os vínculos chegam.
 *
 * O estado de "carregando" é derivado na renderização comparando a chave das
 * dependências, e não zerado dentro do efeito — assim o efeito só chama
 * `setEstado` a partir do callback do Firestore, sem renderizações em cascata.
 */
function useColecao<T>(
  montarQuery: (() => ReturnType<typeof query>) | null,
  converter: (d: QueryDocumentSnapshot<DocumentData>) => T,
  chave: string,
): Estado<T[]> {
  const ativo = firebaseConfigurado() && montarQuery !== null;
  const [estado, setEstado] = useState<Estado<T[]> & { chave: string }>({
    chave,
    dados: [],
    carregando: true,
    erro: null,
  });

  useEffect(() => {
    if (!ativo || !montarQuery) return;
    const cancelar = onSnapshot(
      montarQuery(),
      (snap) => {
        setEstado({
          chave,
          dados: snap.docs.map((d) =>
            converter(d as QueryDocumentSnapshot<DocumentData>),
          ),
          carregando: false,
          erro: null,
        });
      },
      (erro) => {
        setEstado({ chave, dados: [], carregando: false, erro: erro.message });
      },
    );
    return cancelar;
    // `montarQuery` e `converter` são recriados a cada render; `chave` resume
    // as dependências que de fato mudam a consulta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave, ativo]);

  if (!firebaseConfigurado()) {
    return { dados: [], carregando: false, erro: MSG_SEM_CONFIG };
  }
  if (!ativo) {
    return { dados: [], carregando: false, erro: null };
  }
  // Dependências mudaram e o snapshot novo ainda não chegou: volta a carregar
  // em vez de mostrar os dados da consulta anterior.
  if (estado.chave !== chave) {
    return { dados: [], carregando: true, erro: null };
  }
  return estado;
}

export function useEmpreendimentos(): Estado<Empreendimento[]> {
  return useColecao(
    () => query(collection(db(), "empreendimentos"), orderBy("nome")),
    paraEmpreendimento,
    "empreendimentos",
  );
}

export function useEmpreendimento(
  id: string | undefined,
): Estado<Empreendimento | null> {
  const ativo = firebaseConfigurado() && Boolean(id);
  const [estado, setEstado] = useState<
    Estado<Empreendimento | null> & { chave: string }
  >({ chave: id ?? "", dados: null, carregando: true, erro: null });

  useEffect(() => {
    if (!ativo || !id) return;
    const cancelar = onSnapshot(
      doc(db(), "empreendimentos", id),
      (snap) => {
        setEstado({
          chave: id,
          dados: snap.exists()
            ? paraEmpreendimento(snap as QueryDocumentSnapshot<DocumentData>)
            : null,
          carregando: false,
          erro: null,
        });
      },
      (erro) =>
        setEstado({ chave: id, dados: null, carregando: false, erro: erro.message }),
    );
    return cancelar;
  }, [id, ativo]);

  if (!firebaseConfigurado()) {
    return { dados: null, carregando: false, erro: MSG_SEM_CONFIG };
  }
  if (!id) {
    return { dados: null, carregando: false, erro: null };
  }
  if (estado.chave !== id) {
    return { dados: null, carregando: true, erro: null };
  }
  return estado;
}

export function useReunioes(empreendimentoId: string | undefined): Estado<Reuniao[]> {
  return useColecao(
    empreendimentoId
      ? () =>
          query(
            collection(db(), "empreendimentos", empreendimentoId, "reunioes"),
            orderBy("createdAt", "desc"),
          )
      : null,
    paraReuniao,
    `reunioes:${empreendimentoId ?? ""}`,
  );
}

/** Temas de um empreendimento, ou de todos quando `empreendimentoId` é undefined. */
export function useTemas(empreendimentoId?: string): Estado<Tema[]> {
  return useColecao(
    () =>
      empreendimentoId
        ? query(
            collection(db(), "temas"),
            where("empreendimentoId", "==", empreendimentoId),
          )
        : query(collection(db(), "temas")),
    paraTema,
    `temas:${empreendimentoId ?? ""}`,
  );
}

/** Cria um empreendimento e devolve o ID gerado. */
export async function criarEmpreendimento(
  nome: string,
  localizacao: string,
): Promise<string> {
  const ref = await addDoc(collection(db(), "empreendimentos"), {
    nome: nome.trim(),
    localizacao: localizacao.trim(),
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Mapa reuniaoId → reunião, para exibir a origem de cada tema na tabela. */
export function useMapaReunioes(reunioes: Reuniao[]): Map<string, Reuniao> {
  return useMemo(() => new Map(reunioes.map((r) => [r.id, r])), [reunioes]);
}
