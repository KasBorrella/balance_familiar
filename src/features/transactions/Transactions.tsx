import { useState } from "react";
import { Search, ArrowDownLeft, ArrowUpRight, PiggyBank } from "lucide-react";
import { useFinance } from "@/app/context";
import { money } from "@/domain/money";
import {
  AddButton,
  Card,
  PageHeading,
  Empty,
  RowActions,
} from "@/components/common";
import { transactionLabel } from "@/components/editor";
export function Transactions() {
  const { data, period, open, remove } = useFinance();
  const [search, setSearch] = useState("");
  const [direction, setDirection] = useState("");
  const [category, setCategory] = useState("");
  const rows = data.transactions
    .filter(
      (t) =>
        t.date.startsWith(period) &&
        (!direction || t.direction === direction) &&
        (!category || t.categoryId === category) &&
        t.memo.toLocaleLowerCase("es").includes(search.toLocaleLowerCase("es")),
    )
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <>
      <PageHeading
        eyebrow="HISTORIAL"
        title="Movimientos"
        description="Consulta y anota cobros, pagos y aportaciones al ahorro."
        action={
          <AddButton onClick={() => open({ kind: "transaction" })}>
            Movimiento
          </AddButton>
        }
      />
      <Card>
        <div className="filters">
          <label className="search-input">
            <Search size={18} />
            <input
              aria-label="Buscar movimientos"
              placeholder="Buscar un movimiento…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <select
            aria-label="Filtrar por tipo"
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            <option value="">Todos los movimientos</option>
            {(["expense", "income", "savings_in", "savings_out"] as const).map(
              (d) => (
                <option key={d} value={d}>
                  {transactionLabel(d)}
                </option>
              ),
            )}
          </select>
          <select
            aria-label="Filtrar por categoría"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {data.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {rows.length ? (
          <div>
            {rows.map((t) => (
              <div className="transaction-row" key={t.id}>
                <span
                  className={`stat-icon ${t.direction === "income" ? "green" : t.direction === "expense" ? "peach" : "lavender"}`}
                >
                  {t.direction === "income" ? (
                    <ArrowDownLeft size={20} />
                  ) : t.direction === "expense" ? (
                    <ArrowUpRight size={20} />
                  ) : (
                    <PiggyBank size={20} />
                  )}
                </span>
                <div>
                  <strong>{t.memo}</strong>
                  <small>
                    {t.date.split("-").reverse().join("/")} ·{" "}
                    {data.categories.find((c) => c.id === t.categoryId)?.name ||
                      transactionLabel(t.direction)}
                    {t.fundId ? " · pagado con fondo" : ""}
                    {t.source === "demo" ? " · ejemplo" : ""}
                  </small>
                </div>
                <strong className={t.direction === "income" ? "positive" : ""}>
                  {t.direction === "income"
                    ? "+"
                    : t.direction === "expense"
                      ? "−"
                      : ""}
                  {money(t.amountCents)}
                </strong>
                <RowActions
                  name={t.memo}
                  edit={() => open({ kind: "transaction", row: t })}
                  remove={() => remove("transactions", t.id, t.memo)}
                />
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title="No hay movimientos con estos filtros"
            description="Registra tu primer movimiento o cambia los filtros y el mes seleccionado."
          />
        )}
      </Card>
    </>
  );
}
