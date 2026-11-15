import { ArrowUpRight, Pencil, Trash2, Plus, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./ui/button";
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function SectionTitle({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Inbox />
      </span>
      <h3>{title}</h3>
      <p className="muted">{description}</p>
      {action}
    </div>
  );
}
export function AddButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <Button onClick={onClick}>
      <Plus size={18} />
      {children}
    </Button>
  );
}
export function RowActions({
  name,
  edit,
  remove,
}: {
  name: string;
  edit?: () => void;
  remove?: () => void;
}) {
  return (
    <div className="row-actions">
      {edit && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Editar ${name}`}
          onClick={edit}
        >
          <Pencil size={16} />
        </Button>
      )}
      {remove && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Eliminar ${name}`}
          onClick={remove}
        >
          <Trash2 size={16} />
        </Button>
      )}
    </div>
  );
}
export function LinkArrow() {
  return <ArrowUpRight size={17} aria-hidden />;
}
export function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div
      className={`progress ${value > 100 ? "over" : ""}`}
      role="progressbar"
      aria-label={label}
      aria-valuenow={Math.round(Math.max(0, Math.min(100, value)))}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
