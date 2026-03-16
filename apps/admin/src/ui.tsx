import type { ReactNode } from "react";

import { Button as UIButton } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { cn } from "./lib/utils";

export function formatDate(value?: string | null) {
  if (!value) {
    return "Not set";
  }

  return new Date(value).toLocaleString();
}

export function toDateInputValue(value?: string | null) {
  return value ? new Date(value).toISOString().slice(0, 16) : "";
}

export function toIsoValue(value: string) {
  return value ? new Date(value).toISOString() : null;
}

export function ShellCard(props: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("overflow-hidden", props.className)}>
      <CardHeader className="gap-3 border-b border-black/5 bg-white/40">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <p className="section-kicker">Donggeuri</p>
            <CardTitle>{props.title}</CardTitle>
            {props.description ? <CardDescription>{props.description}</CardDescription> : null}
          </div>
          {props.actions ? <div className="flex flex-wrap gap-3">{props.actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="p-6">{props.children}</CardContent>
    </Card>
  );
}

export const Button = UIButton;

export function ErrorMessage(props: { message: string | null }) {
  return props.message ? (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
      {props.message}
    </div>
  ) : null;
}

export function LoadingPanel(props: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ShellCard title="Loading" description={props.message}>
        <div className="rounded-[24px] bg-[var(--color-paper-muted)] px-5 py-6 text-sm text-[var(--color-soft-ink)]">
          Please wait a moment.
        </div>
      </ShellCard>
    </div>
  );
}
