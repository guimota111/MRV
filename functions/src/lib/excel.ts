import ExcelJS from "exceljs";
import { STATUS_TEMA, StatusTema, Tema } from "../domain";
import { agruparRecorrentes } from "./grupos";

/**
 * Cores por status, iguais às usadas na planilha que o time já validava:
 * verde = Resolvido, amarelo = Em andamento, vermelho = Pendente.
 */
const COR_STATUS: Record<StatusTema, { fundo: string; texto: string }> = {
  Resolvido: { fundo: "FFD1FAE5", texto: "FF065F46" },
  "Em andamento": { fundo: "FFFEF3C7", texto: "FF92400E" },
  Pendente: { fundo: "FFFEE2E2", texto: "FF991B1B" },
};

const COR_CABECALHO = "FF1E3A5F";

interface Coluna {
  header: string;
  key: string;
  width: number;
}

const COLUNAS: Coluna[] = [
  { header: "Empreendimento", key: "empreendimentoNome", width: 28 },
  { header: "Data", key: "dataReuniao", width: 12 },
  { header: "Disciplina", key: "disciplina", width: 18 },
  { header: "Tema", key: "tema", width: 40 },
  { header: "Contexto/Discussão", key: "contexto", width: 60 },
  { header: "Solução/Encaminhamento", key: "solucao", width: 60 },
  { header: "Responsável", key: "responsavel", width: 20 },
  { header: "Prazo", key: "prazo", width: 14 },
  { header: "Status", key: "status", width: 16 },
];

function estilizarCabecalho(planilha: ExcelJS.Worksheet) {
  const linha = planilha.getRow(1);
  linha.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  linha.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: COR_CABECALHO },
  };
  linha.alignment = { vertical: "middle", horizontal: "left" };
  linha.height = 22;
  planilha.views = [{ state: "frozen", ySplit: 1 }];
}

/** Aplica AutoFilter sobre a faixa preenchida da planilha. */
function aplicarAutoFilter(planilha: ExcelJS.Worksheet, colunas: number) {
  const ultimaColuna = planilha.getColumn(colunas).letter;
  planilha.autoFilter = {
    from: "A1",
    to: `${ultimaColuna}${Math.max(planilha.rowCount, 1)}`,
  };
}

function montarAbaTemas(
  workbook: ExcelJS.Workbook,
  nome: string,
  temas: Tema[],
) {
  // Nome de aba no Excel: máx. 31 caracteres e sem : \ / ? * [ ]
  const nomeSeguro = nome.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Aba";
  const planilha = workbook.addWorksheet(nomeSeguro);
  planilha.columns = COLUNAS.map((c) => ({
    header: c.header,
    key: c.key,
    width: c.width,
  }));
  estilizarCabecalho(planilha);

  for (const tema of temas) {
    const linha = planilha.addRow({
      empreendimentoNome: tema.empreendimentoNome,
      dataReuniao: tema.dataReuniao,
      disciplina: tema.disciplina,
      tema: tema.tema,
      contexto: tema.contexto,
      solucao: tema.solucao,
      responsavel: tema.responsavel,
      prazo: tema.prazo,
      status: tema.status,
    });
    linha.alignment = { vertical: "top", wrapText: true };

    const celulaStatus = linha.getCell("status");
    const cor = COR_STATUS[tema.status];
    if (cor) {
      celulaStatus.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: cor.fundo },
      };
      celulaStatus.font = { bold: true, color: { argb: cor.texto } };
      celulaStatus.alignment = { vertical: "middle", horizontal: "center" };
    }
  }

  aplicarAutoFilter(planilha, COLUNAS.length);
  return planilha;
}

function montarAbaRecorrentes(workbook: ExcelJS.Workbook, temas: Tema[]) {
  const planilha = workbook.addWorksheet("Temas Recorrentes");
  planilha.columns = [
    { header: "Grupo", key: "grupo", width: 8 },
    { header: "Empreendimento", key: "empreendimentoNome", width: 28 },
    { header: "Data", key: "dataReuniao", width: 12 },
    { header: "Disciplina", key: "disciplina", width: 18 },
    { header: "Tema", key: "tema", width: 40 },
    { header: "Contexto/Discussão", key: "contexto", width: 60 },
    { header: "Solução/Encaminhamento", key: "solucao", width: 60 },
    { header: "Status", key: "status", width: 16 },
  ];
  estilizarCabecalho(planilha);

  const grupos = agruparRecorrentes(temas);
  // Sem linhas em branco entre os grupos: elas interromperiam a faixa do
  // AutoFilter no Excel. A coluna "Grupo" já separa visualmente.
  grupos.forEach((grupo, indice) => {
    for (const tema of grupo) {
      const linha = planilha.addRow({
        grupo: indice + 1,
        empreendimentoNome: tema.empreendimentoNome,
        dataReuniao: tema.dataReuniao,
        disciplina: tema.disciplina,
        tema: tema.tema,
        contexto: tema.contexto,
        solucao: tema.solucao,
        status: tema.status,
      });
      linha.alignment = { vertical: "top", wrapText: true };
      // Linhas de grupos alternados recebem um fundo suave, para leitura.
      if (indice % 2 === 1) {
        linha.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8FAFC" },
        };
      }
      const cor = COR_STATUS[tema.status];
      if (cor) {
        const celula = linha.getCell("status");
        celula.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: cor.fundo },
        };
        celula.font = { bold: true, color: { argb: cor.texto } };
      }
    }
  });

  if (grupos.length === 0) {
    planilha.addRow({
      grupo: "",
      empreendimentoNome: "Nenhum tema recorrente identificado até o momento.",
    });
  }

  aplicarAutoFilter(planilha, 8);
  return planilha;
}

function montarAbaStatus(workbook: ExcelJS.Workbook, temas: Tema[]) {
  const planilha = workbook.addWorksheet("Status");
  planilha.columns = [
    { header: "Status", key: "status", width: 20 },
    { header: "Quantidade", key: "quantidade", width: 14 },
    { header: "% do total", key: "percentual", width: 12 },
  ];
  estilizarCabecalho(planilha);

  const total = temas.length;
  for (const status of STATUS_TEMA) {
    const quantidade = temas.filter((t) => t.status === status).length;
    const linha = planilha.addRow({
      status,
      quantidade,
      percentual: total > 0 ? quantidade / total : 0,
    });
    linha.getCell("percentual").numFmt = "0.0%";
    const cor = COR_STATUS[status];
    const celula = linha.getCell("status");
    celula.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: cor.fundo },
    };
    celula.font = { bold: true, color: { argb: cor.texto } };
  }

  const totalLinha = planilha.addRow({
    status: "Total",
    quantidade: total,
    percentual: total > 0 ? 1 : 0,
  });
  totalLinha.font = { bold: true };
  totalLinha.getCell("percentual").numFmt = "0.0%";

  return planilha;
}

/**
 * Monta o workbook completo: "Resumo Geral", uma aba por empreendimento,
 * "Temas Recorrentes" e "Status".
 */
export async function gerarWorkbook(temas: Tema[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "MRV — Consolidação de Briefings";
  workbook.created = new Date();

  montarAbaTemas(workbook, "Resumo Geral", temas);

  // Uma aba por empreendimento, na ordem alfabética do nome.
  const porEmpreendimento = new Map<string, Tema[]>();
  for (const tema of temas) {
    const chave = tema.empreendimentoNome || "Sem nome";
    const lista = porEmpreendimento.get(chave);
    if (lista) lista.push(tema);
    else porEmpreendimento.set(chave, [tema]);
  }
  const nomesUsados = new Set<string>(["Resumo Geral"]);
  for (const nome of [...porEmpreendimento.keys()].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  )) {
    // Dois empreendimentos podem colidir depois do corte em 31 caracteres.
    let nomeAba = nome.replace(/[:\\/?*[\]]/g, "-").slice(0, 31) || "Aba";
    let sufixo = 2;
    while (nomesUsados.has(nomeAba)) {
      const corte = `${nome}`.slice(0, 28);
      nomeAba = `${corte} ${sufixo}`.slice(0, 31);
      sufixo += 1;
    }
    nomesUsados.add(nomeAba);
    montarAbaTemas(workbook, nomeAba, porEmpreendimento.get(nome) as Tema[]);
  }

  montarAbaRecorrentes(workbook, temas);
  montarAbaStatus(workbook, temas);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Nome de arquivo seguro para o header Content-Disposition. */
export function nomeArquivoExport(escopo: string): string {
  const data = new Date().toISOString().slice(0, 10);
  const base = escopo
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
  return `briefings-${base || "geral"}-${data}.xlsx`;
}
