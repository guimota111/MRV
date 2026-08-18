"use client";

import { FileSpreadsheet } from "lucide-react";
import { urlExportarExcel } from "@/lib/api";
import { firebaseConfigurado } from "@/lib/firebase";
import { BotaoLink } from "./ui";

/**
 * Link direto para a Cloud Function que gera o .xlsx — assim o download fica
 * a cargo do navegador, sem passar o arquivo pela memória do React.
 */
export function BotaoExportar({
  empreendimentoId,
  variante = "secundario",
}: {
  empreendimentoId?: string;
  variante?: "primario" | "secundario" | "sutil";
}) {
  if (!firebaseConfigurado()) return null;

  return (
    <BotaoLink
      href={urlExportarExcel(empreendimentoId)}
      variante={variante}
      className="sem-impressao"
      // Sem `target`: o Content-Disposition da function já força o download.
    >
      <FileSpreadsheet aria-hidden className="size-4" />
      Exportar Excel
    </BotaoLink>
  );
}
