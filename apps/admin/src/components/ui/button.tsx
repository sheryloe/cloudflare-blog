import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ring-offset-background",
  {
    variants: {
      variant: {
        default: "bg-[var(--color-ink)] text-[var(--color-paper)] shadow-sm hover:bg-[var(--color-accent)]",
        ghost: "bg-transparent text-foreground hover:bg-black/5",
        outline: "border border-border bg-background hover:bg-black/[0.03]",
        soft: "bg-[var(--color-muted)] text-[var(--color-ink)] hover:bg-[var(--color-muted-strong)]",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-4 py-2",
        lg: "h-12 px-6 py-3",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}

export { buttonVariants };
