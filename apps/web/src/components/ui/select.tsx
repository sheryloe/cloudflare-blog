import type * as React from "react";

import { cn } from "../../lib/utils";

export function Select({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "flex h-11 w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-panel-strong)] px-4 py-2 text-sm text-[var(--color-ink)] shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/35",
        className,
      )}
      {...props}
    />
  );
}
