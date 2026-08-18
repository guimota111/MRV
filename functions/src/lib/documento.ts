import mammoth from "mammoth";

/** Limite de payload da API da Anthropic para um documento. */
export const LIMITE_PDF_BYTES = 32 * 1024 * 1024;

export type TipoDocumento = "pdf" | "docx";

export function detectarTipo(nomeArquivo: string): TipoDocumento | null {
  const nome = nomeArquivo.toLowerCase();
  if (nome.endsWith(".pdf")) return "pdf";
  if (nome.endsWith(".docx")) return "docx";
  return null;
}

/**
 * Extrai o texto de um DOCX ignorando as imagens.
 *
 * As atas manuais da MRV têm screenshots de croquis incorporados, o que deixa
 * o arquivo enorme; a informação relevante está no texto e nas legendas.
 * `convertToHtml` com um conversor de imagem vazio descarta os binários e
 * preserva a estrutura (títulos de disciplina, listas), que ajuda o modelo a
 * separar as seções.
 */
export async function extrairTextoDocx(buffer: Buffer): Promise<string> {
  const resultado = await mammoth.convertToHtml(
    { buffer },
    { convertImage: mammoth.images.imgElement(async () => ({ src: "" })) },
  );

  return htmlParaTexto(resultado.value);
}

/**
 * Converte o HTML do mammoth em texto simples preservando as quebras de bloco.
 * Não usamos um parser de HTML completo porque a saída do mammoth é previsível
 * e só precisamos das fronteiras de parágrafo/título/item de lista.
 *
 * Células de tabela viram " | ": o separador sobrevive à normalização de
 * espaços em branco (um \t não sobreviveria) e é justamente o formato das atas
 * do Forma, que o modelo já lê bem.
 */
export function htmlParaTexto(html: string): string {
  return html
    .replace(/<img[^>]*>/gi, "")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<\/(p|h[1-6]|li|tr|div)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .split("\n")
    // Colapsa espaços e remove o separador pendurado no fim/começo da linha.
    .map((l) =>
      l
        .replace(/\s+/g, " ")
        .replace(/(?:\s*\|\s*)+$/, "")
        .replace(/^(?:\s*\|\s*)+/, "")
        .trim(),
    )
    // Colapsa sequências de linhas vazias numa só.
    .filter((l, i, arr) => l !== "" || arr[i - 1] !== "")
    .join("\n")
    .trim();
}
