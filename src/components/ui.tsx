"use client";

import clsx from "clsx";
import Link from "next/link";
import { ReactNode } from "react";
import { CLASSE_STATUS, StatusTema } from "@/lib/domain";

export function Cartao({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function TituloSecao({
  children,
  acao,
  descricao,
}: {
  children: ReactNode;
  acao?: ReactNode;
  descricao?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          {children}
        </h2>
        {descricao ? (
          <p className="mt-1 text-sm text-slate-500">{descricao}</p>
        ) : null}
      </div>
      {acao}
    </div>
  );
}

export function BadgeStatus({ status }: { status: StatusTema }) {
  return (
    <span
      className={clsx(
        "inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        CLASSE_STATUS[status],
      )}
    >
      {status}
    </span>
  );
}

export function Etiqueta({
  children,
  cor,
  className,
}: {
  children: ReactNode;
  cor?: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700",
        className,
      )}
    >
      {cor ? (
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ backgroundColor: cor }}
        />
      ) : null}
      {children}
    </span>
  );
}

type VarianteBotao = "primario" | "secundario" | "sutil";

const CLASSES_BOTAO: Record<VarianteBotao, string> = {
  primario:
    "bg-marca-700 text-white hover:bg-marca-800 focus-visible:outline-marca-700",
  secundario:
    "bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus-visible:outline-slate-400",
  sutil:
    "bg-transparent text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-400",
};

const BASE_BOTAO =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function Botao({
  variante = "primario",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: VarianteBotao;
}) {
  return (
    <button
      {...props}
      className={clsx(BASE_BOTAO, CLASSES_BOTAO[variante], className)}
    />
  );
}

export function BotaoLink({
  variante = "primario",
  className,
  href,
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variante?: VarianteBotao;
  href: string;
}) {
  const externo = href.startsWith("http");
  const classe = clsx(BASE_BOTAO, CLASSES_BOTAO[variante], className);
  if (externo) {
    return <a {...props} href={href} className={classe} />;
  }
  return <Link {...props} href={href} className={classe} />;
}

export function Campo({
  rotulo,
  dica,
  children,
}: {
  rotulo: string;
  dica?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {rotulo}
      </span>
      {children}
      {dica ? <span className="mt-1.5 block text-xs text-slate-500">{dica}</span> : null}
    </label>
  );
}

export const CLASSE_INPUT =
  "block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-marca-600";

export function Vazio({
  titulo,
  children,
  icone,
}: {
  titulo: string;
  children?: ReactNode;
  icone?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
      {icone ? <div className="text-slate-400">{icone}</div> : null}
      <p className="text-sm font-medium text-slate-900">{titulo}</p>
      {children ? (
        <div className="max-w-md text-sm text-slate-500">{children}</div>
      ) : null}
    </div>
  );
}

export function Carregando({ texto = "Carregando…" }: { texto?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 px-6 py-12 text-sm text-slate-500">
      <span
        aria-hidden
        className="size-4 animate-spin rounded-full border-2 border-slate-300 border-t-marca-600"
      />
      {texto}
    </div>
  );
}

export function Alerta({
  tom = "erro",
  titulo,
  children,
}: {
  tom?: "erro" | "aviso" | "info";
  titulo?: string;
  children: ReactNode;
}) {
  const cores = {
    erro: "border-rose-200 bg-rose-50 text-rose-800",
    aviso: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-marca-200 bg-marca-50 text-marca-900",
  }[tom];
  return (
    <div className={clsx("rounded-lg border px-4 py-3 text-sm", cores)}>
      {titulo ? <p className="font-semibold">{titulo}</p> : null}
      <div className={titulo ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}

export function Estatistica({
  rotulo,
  valor,
  detalhe,
  cor,
}: {
  rotulo: string;
  valor: ReactNode;
  detalhe?: ReactNode;
  cor?: string;
}) {
  return (
    <Cartao className="px-5 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {rotulo}
      </p>
      <p
        className="mt-1 text-3xl font-semibold tracking-tight"
        style={{ color: cor ?? "#0f172a" }}
      >
        {valor}
      </p>
      {detalhe ? (
        <p className="mt-1 text-xs text-slate-500">{detalhe}</p>
      ) : null}
    </Cartao>
  );
}
