import type { ReactNode } from "react";

import { Button as UIButton } from "./components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { cn } from "./lib/utils";

export function formatDate(value?: string | null) {
  if (!value) {
    return "미설정";
  }

  return new Date(value).toLocaleString();
}

export function toDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const localValue = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localValue.toISOString().slice(0, 16);
}

export function toIsoValue(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function ShellCard(props: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn("admin-panel overflow-hidden", props.className)}>
      <CardHeader className="gap-4 border-b border-black/5 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(242,246,251,0.76))]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="inline-flex w-fit items-center rounded-full border border-black/8 bg-white/70 px-3 py-1.5 shadow-sm">
              <p className="section-kicker !tracking-[0.28em]">에디터 운영</p>
            </div>
            <CardTitle className="text-2xl sm:text-[2rem]">{props.title}</CardTitle>
            {props.description ? <CardDescription>{props.description}</CardDescription> : null}
          </div>
          {props.actions ? <div className="flex flex-wrap gap-3">{props.actions}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="p-6 sm:p-8">{props.children}</CardContent>
    </Card>
  );
}

export const Button = UIButton;

export function ErrorMessage(props: { message: string | null }) {
  return props.message ? (
    <div className="rounded-[24px] border border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,241,242,0.98),rgba(255,247,237,0.96))] px-4 py-3 text-sm font-medium text-rose-700 shadow-sm">
      {props.message}
    </div>
  ) : null;
}

export function LoadingPanel(props: { message: string }) {
  return (
    <div className="mx-auto w-full max-w-3xl">
      <ShellCard title="로딩 중" description={props.message}>
        <div className="rounded-[28px] border border-black/5 bg-white/65 px-5 py-8 text-sm text-[var(--color-soft-ink)]">
          작업공간을 준비하는 중입니다. 잠시만 기다려 주세요.
        </div>
      </ShellCard>
    </div>
  );
}
