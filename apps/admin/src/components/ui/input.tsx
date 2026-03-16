import type * as React from "react";

import { cn } from "../../lib/utils";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "flex h-11 w-full rounded-2xl border border-black/10 bg-white px-4 py-2 text-sm text-[var(--color-ink)] shadow-sm transition-colors placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/35",
        className,
      )}
      {...props}
    />
  );
}
