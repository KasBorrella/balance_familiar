import { ChevronRight, Folder, Plus } from "lucide-react";
import { useFinance } from "@/app/context";
import { categoryTotal } from "@/domain/finance";
import { frequencyLabels, occurrences } from "@/domain/calendar";
import { money } from "@/domain/money";
import { Button } from "@/components/ui/button";
import { RowActions, Empty } from "@/components/common";
import type { Category } from "@/domain/models";
export function ExpenseTree() {
  const { data, period, open, remove } = useFinance();
  function branch(category: Category, depth = 0) {
    const children = data.categories
      .filter((c) => c.parentId === category.id)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const rules = data.expenseRules.filter((r) => r.categoryId === category.id);
    return (
      <details
        className={`category-group depth-${depth}`}
        key={category.id}
        open={undefined}
      >
        <summary>
          <ChevronRight size={17} className="chevron" />
          <span className={`category-icon color-${category.sortOrder % 5}`}>
            <Folder size={18} />
          </span>
          <div>
            <strong>{category.name}</strong>
            <small>
              {rules.length} conceptos
              {children.length ? ` · ${children.length} subcategorías` : ""}
            </small>
          </div>
          <strong data-testid={`subtotal-${category.name}`}>
            {money(categoryTotal(data, category.id, period))}
          </strong>
        </summary>
        <div className="category-content">
          <div className="category-toolbar">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                open({ kind: "expense", defaults: { categoryId: category.id } })
              }
            >
              <Plus size={15} />
              Añadir gasto
            </Button>
            <RowActions
              name={category.name}
              edit={() => open({ kind: "category", row: category })}
              remove={() => remove("categories", category.id, category.name)}
            />
          </div>
          {rules.map((rule) => {
            const count = occurrences(rule, period).length;
            return (
              <div className="expense-row" key={rule.id}>
                <div>
                  <strong>{rule.name}</strong>
                  <small>
                    {frequencyLabels[rule.frequency]} ·{" "}
                    {rule.kind === "fixed" ? "Fijo" : "Variable"}
                    {rule.activeMonths.length > 0
                      ? " · meses seleccionados"
                      : ""}
                  </small>
                  {rule.notes && <small>{rule.notes}</small>}
                </div>
                <div className="amount-column">
                  <strong>{money(count * rule.amountCents)}</strong>
                  <small>
                    {count === 0
                      ? "Sin cargo este mes"
                      : count > 1
                        ? `${count} × ${money(rule.amountCents)}`
                        : "Previsto este mes"}
                  </small>
                </div>
                <RowActions
                  name={rule.name}
                  edit={() => open({ kind: "expense", row: rule })}
                  remove={() => remove("expenseRules", rule.id, rule.name)}
                />
              </div>
            );
          })}
          {children.map((c) => branch(c, depth + 1))}
          {rules.length === 0 && children.length === 0 && (
            <p className="muted empty-inline">
              Esta categoría todavía no tiene gastos previstos.
            </p>
          )}
        </div>
      </details>
    );
  }
  return data.categories.length ? (
    <div className="category-tree">
      {data.categories
        .filter((c) => !c.parentId && c.type === "expense")
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((c) => branch(c))}
    </div>
  ) : (
    <Empty
      title="Aún no hay categorías de gasto"
      description="Crea una categoría, como Educación e hijos, y añade sus conceptos."
      action={
        <Button onClick={() => open({ kind: "category" })}>
          Crear categoría
        </Button>
      }
    />
  );
}
