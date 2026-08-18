import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import { LayoutGrid, Building2 } from "lucide-react";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Consolidação de Briefings de Instalações — MRV",
  description:
    "Extrai, consolida e cruza os temas discutidos nas reuniões de briefing de instalações de cada empreendimento.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-dvh font-sans">
        <header className="sem-impressao sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="mx-auto flex max-w-[1600px] items-center gap-6 px-6 py-3">
            <Link href="/" className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid size-8 place-items-center rounded-lg bg-marca-700 text-sm font-bold text-white"
              >
                M
              </span>
              <span className="leading-tight">
                <span className="block text-sm font-semibold text-slate-900">
                  Briefings de Instalações
                </span>
                <span className="block text-xs text-slate-500">MRV Engenharia</span>
              </span>
            </Link>

            <nav className="ml-auto flex items-center gap-1 text-sm">
              <ItemNav href="/" icone={<Building2 aria-hidden className="size-4" />}>
                Empreendimentos
              </ItemNav>
              <ItemNav href="/dashboard" icone={<LayoutGrid aria-hidden className="size-4" />}>
                Visão geral
              </ItemNav>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-6 py-8">{children}</main>

        <footer className="sem-impressao border-t border-slate-200 py-6">
          <p className="mx-auto max-w-[1600px] px-6 text-xs text-slate-400">
            Protótipo interno · extração assistida por IA — revise os dados antes
            de usar em decisão de projeto.
          </p>
        </footer>
      </body>
    </html>
  );
}

function ItemNav({
  href,
  icone,
  children,
}: {
  href: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
    >
      {icone}
      {children}
    </Link>
  );
}
