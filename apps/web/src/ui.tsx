import type { ReactNode } from "react";

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
}) {
  return (
    <section className="shell-card">
      <div className="shell-card__header">
        <div>
          <p className="eyebrow">Donggeuri</p>
          <h2>{props.title}</h2>
        </div>
        {props.actions ? <div className="actions-row">{props.actions}</div> : null}
      </div>
      {props.description ? <p className="shell-copy">{props.description}</p> : null}
      {props.children}
    </section>
  );
}

export function Button(
  props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    tone?: "primary" | "ghost" | "danger";
  },
) {
  return (
    <button
      {...props}
      className={`button button--${props.tone ?? "primary"} ${props.className ?? ""}`.trim()}
    />
  );
}

export function ErrorMessage(props: { message: string | null }) {
  return props.message ? <p className="error-text">{props.message}</p> : null;
}

export function LoadingPanel(props: { message: string }) {
  return (
    <div className="main-column">
      <ShellCard title="Loading" description={props.message}>
        <div className="empty-state">Please wait a moment.</div>
      </ShellCard>
    </div>
  );
}
