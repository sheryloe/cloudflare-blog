/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ADMIN_APP_URL?: string;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_GA_MEASUREMENT_ID?: string;
  readonly VITE_PUBLIC_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "react-syntax-highlighter" {
  import type { CSSProperties, ElementType, ReactNode } from "react";

  export interface SyntaxHighlighterProps {
    children?: ReactNode;
    language?: string;
    style?: Record<string, CSSProperties>;
    customStyle?: CSSProperties;
    codeTagProps?: {
      style?: CSSProperties;
    };
    className?: string;
    PreTag?: ElementType;
    [key: string]: unknown;
  }

  export const Prism: (props: SyntaxHighlighterProps) => ReactNode;
}

declare module "react-syntax-highlighter/dist/esm/styles/prism" {
  import type { CSSProperties } from "react";

  export const oneDark: Record<string, CSSProperties>;
}
