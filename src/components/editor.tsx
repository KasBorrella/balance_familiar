import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useFinance, type EditorRequest } from "@/app/context";
import {
  metadata,
  type ExpenseRule,
  type Transaction,
  type TableName,
  type Row,
} from "@/domain/models";
import {
  today,
  frequencyLabels,
  monthNames,
  occurrences,
  shiftMonth,
} from "@/domain/calendar";
import { money, moneyInput, parseMoney } from "@/domain/money";
import { repository } from "@/db/repository";
import { Modal } from "./ui/dialog";
import { Button } from "./ui/button";
type Field = {
  key: string;
  label: string;
  type?: "money" | "number" | "date" | "select" | "textarea";
  options?: [string, string][];
  optional?: boolean;
  hint?: string;
};
const tableFor = {
  category: "categories",
  expense: "expenseRules",
  income: "incomeRules",
  budget: "monthlyBudgets",
  allocation: "budgetAllocations",
  transaction: "transactions",
  fund: "sinkingFunds",
  goal: "savingsGoals",
  entry: "fundEntries",
} as const;
const titles = {
  category: "categoría",
  expense: "gasto previsto",
  income: "ingreso previsto",
  budget: "plan del mes",
  allocation: "presupuesto variable",
  transaction: "movimiento",
  fund: "fondo para gastos futuros",
  goal: "objetivo de ahorro",
  entry: "aportación al fondo",
};
export function errorMessage(error: unknown) {
  return error instanceof z.ZodError
    ? error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .slice(0, 3)
        .join(" · ")
    : error instanceof Error
      ? error.message
      : "No se ha podido guardar. Comprueba el almacenamiento e inténtalo de nuevo.";
}
export function Editor({
  request,
  close,
}: {
  request: EditorRequest;
  close: () => void;
}) {
  const { data, period, notify } = useFinance();
  const { kind, row } = request;
  const [error, setError] = useState("");
  const defaults = useMemo(() => {
    const result: Record<string, string> = {
      name: "",
      amountCents: "",
      categoryId: "",
      parentId: "",
      sortOrder: String(data.categories.length),
      type: "expense",
      frequency: "MONTHLY",
      activeMonths: "",
      dueDay: "1",
      startDate: `${period}-01`,
      endDate: "",
      kind: "fixed",
      fundId: "",
      notes: "",
      status: kind === "income" ? "estimated" : "draft",
      openingCashCents: "0",
      savingsTargetCents: "0",
      direction: "expense",
      date: period === today().slice(0, 7) ? today() : `${period}-01`,
      memo: "",
      expenseRuleId: "",
      incomeRuleId: "",
      occurrenceDate: "",
      goalId: "",
      targetCents: "",
      monthlyCents: "",
      dueDate: `${shiftMonth(period, 12)}-01`,
      deadline: `${shiftMonth(period, 12)}-01`,
      active: "true",
      entryType: "contribution",
    };
    if (row)
      for (const [key, value] of Object.entries(row))
        result[key] =
          value === null
            ? ""
            : key.endsWith("Cents")
              ? moneyInput(value as number)
              : Array.isArray(value)
                ? value.join(",")
                : String(value);
    return { ...result, ...request.defaults };
  }, [row, kind, period, data.categories.length, request.defaults]);
  const options = (items: { id: string; name: string }[]): [string, string][] =>
    items.map((c) => [c.id, c.name]);
  const categories = options(
    data.categories.filter((c) => !c.archivedAt && c.type === "expense"),
  );
  const common: Field[] = [
    { key: "name", label: "Nombre" },
    { key: "amountCents", label: "Importe (€)", type: "money" },
  ];
  const recurring: Field[] = [
    {
      key: "frequency",
      label: "Frecuencia",
      type: "select",
      options: Object.entries(frequencyLabels),
    },
    {
      key: "startDate",
      label: "Fecha de inicio",
      type: "date",
      hint: "En pagos semanales, fija el día de la semana; en pagos anuales o trimestrales, el mes de referencia.",
    },
    { key: "endDate", label: "Fecha de fin", type: "date", optional: true },
    {
      key: "dueDay",
      label: kind === "income" ? "Día de cobro" : "Día de cargo",
      type: "number",
      hint: "Si el mes es más corto, se usa su último día.",
    },
  ];
  const definitions: Record<typeof kind, Field[]> = {
    category: [
      { key: "name", label: "Nombre" },
      {
        key: "parentId",
        label: "Categoría superior",
        type: "select",
        options: options(
          data.categories.filter(
            (c) => !row || !("id" in row) || c.id !== row.id,
          ),
        ),
        optional: true,
      },
      { key: "sortOrder", label: "Orden en la lista", type: "number" },
    ],
    expense: [
      ...common,
      {
        key: "categoryId",
        label: "Categoría",
        type: "select",
        options: categories,
      },
      {
        key: "kind",
        label: "Tipo de gasto",
        type: "select",
        options: [
          ["fixed", "Gasto fijo"],
          ["variable", "Gasto variable"],
        ],
      },
      ...recurring,
      {
        key: "fundId",
        label: "Pagar con un fondo",
        type: "select",
        options: options(data.sinkingFunds),
        optional: true,
        hint: "La previsión usa el saldo anterior al mes y las aportaciones previstas. Solo se descuenta la parte cubierta.",
      },
      { key: "notes", label: "Notas", type: "textarea", optional: true },
    ],
    income: [
      ...common,
      ...recurring,
      {
        key: "status",
        label: "Estado de la previsión",
        type: "select",
        options: [
          ["estimated", "Estimado"],
          ["confirmed", "Confirmado (todavía no cobrado)"],
        ],
      },
    ],
    budget: [
      {
        key: "openingCashCents",
        label: "Saldo de caja al inicio del mes (€)",
        type: "money",
        hint: "Introduce tu saldo inicial. No se obtiene de ningún banco.",
      },
      {
        key: "savingsTargetCents",
        label: "Objetivo de ahorro del mes (€)",
        type: "money",
      },
      {
        key: "status",
        label: "Estado del plan",
        type: "select",
        options: [
          ["draft", "En preparación"],
          ["ready", "Revisado"],
        ],
      },
    ],
    allocation: [
      {
        key: "categoryId",
        label: "Categoría",
        type: "select",
        options: categories,
      },
      {
        key: "amountCents",
        label: "Límite mensual para gastos variables (€)",
        type: "money",
        hint: "Los gastos fijos ya se asignan por su calendario. Este límite cubre solo gastos variables.",
      },
    ],
    transaction: [
      {
        key: "direction",
        label: "Tipo de movimiento",
        type: "select",
        options: [
          ["expense", "Gasto pagado"],
          ["income", "Ingreso cobrado"],
          ["savings_in", "Transferencia a ahorro"],
          ["savings_out", "Retirada de ahorro"],
        ],
      },
      { key: "amountCents", label: "Importe (€)", type: "money" },
      { key: "memo", label: "Concepto" },
      { key: "date", label: "Fecha", type: "date" },
      {
        key: "categoryId",
        label: "Categoría",
        type: "select",
        options: categories,
      },
      {
        key: "expenseRuleId",
        label: "Vincular a gasto previsto",
        type: "select",
        options: options(data.expenseRules),
        optional: true,
      },
      {
        key: "occurrenceDate",
        label: "Vencimiento que estás pagando",
        type: "date",
        optional: true,
      },
      {
        key: "incomeRuleId",
        label: "Vincular a ingreso previsto",
        type: "select",
        options: options(data.incomeRules),
        optional: true,
      },
      {
        key: "fundId",
        label: "Usar dinero de un fondo",
        type: "select",
        options: options(data.sinkingFunds),
        optional: true,
      },
      {
        key: "goalId",
        label: "Objetivo de ahorro",
        type: "select",
        options: options(data.savingsGoals),
        optional: true,
      },
    ],
    fund: [
      { key: "name", label: "Nombre" },
      { key: "targetCents", label: "Importe que necesitas (€)", type: "money" },
      {
        key: "monthlyCents",
        label: "Reserva mensual prevista (€)",
        type: "money",
      },
      { key: "startDate", label: "Inicio de las reservas", type: "date" },
      { key: "dueDate", label: "Fecha del gasto futuro", type: "date" },
      {
        key: "active",
        label: "Estado",
        type: "select",
        options: [
          ["true", "Activo"],
          ["false", "Pausado"],
        ],
      },
    ],
    goal: [
      { key: "name", label: "Nombre" },
      { key: "targetCents", label: "Importe objetivo (€)", type: "money" },
      { key: "deadline", label: "Fecha objetivo", type: "date" },
      {
        key: "active",
        label: "Estado",
        type: "select",
        options: [
          ["true", "Activo"],
          ["false", "Pausado"],
        ],
      },
    ],
    entry: [
      {
        key: "fundId",
        label: "Fondo",
        type: "select",
        options: options(data.sinkingFunds),
      },
      {
        key: "entryType",
        label: "Operación",
        type: "select",
        options: [
          ["contribution", "Aportar dinero al fondo"],
          ["withdrawal", "Devolver dinero al presupuesto"],
        ],
      },
      { key: "amountCents", label: "Importe (€)", type: "money" },
      { key: "date", label: "Fecha", type: "date" },
    ],
  };
  const schema = z.record(z.string(), z.string()).superRefine((values, ctx) => {
    for (const f of definitions[kind]) {
      if (!visible(f.key, values)) continue;
      const value = values[f.key] || "";
      if (!value.trim() && !f.optional) {
        ctx.addIssue({
          code: "custom",
          path: [f.key],
          message: "Completa este campo.",
        });
        continue;
      }
      if (f.type === "money" && value)
        try {
          const amount = parseMoney(value);
          if (amount < 0 && f.key !== "openingCashCents")
            throw new Error("El importe no puede ser negativo.");
          if ((kind === "transaction" || kind === "entry") && amount === 0)
            throw new Error("Introduce un importe mayor que cero.");
        } catch (e) {
          ctx.addIssue({
            code: "custom",
            path: [f.key],
            message: errorMessage(e),
          });
        }
      if (
        f.type === "number" &&
        (!/^\d+$/.test(value) ||
          (f.key === "dueDay" && (+value < 1 || +value > 31)))
      )
        ctx.addIssue({
          code: "custom",
          path: [f.key],
          message: "Introduce un número válido.",
        });
    }
    if (
      kind === "transaction" &&
      values.direction === "expense" &&
      !values.categoryId
    )
      ctx.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Selecciona una categoría.",
      });
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Record<string, string>>({
    defaultValues: defaults,
    resolver: zodResolver(schema),
  });
  const values = watch();
  function visible(key: string, v: Record<string, string>) {
    if (key === "dueDay" && ["WEEKLY", "ONE_OFF"].includes(v.frequency))
      return false;
    if (kind === "expense" && key === "fundId" && v.kind === "variable")
      return false;
    if (kind !== "transaction") return true;
    if (["categoryId", "expenseRuleId", "fundId"].includes(key))
      return v.direction === "expense";
    if (key === "incomeRuleId") return v.direction === "income";
    if (key === "occurrenceDate")
      return v.direction === "expense" && !!v.expenseRuleId;
    if (key === "goalId") return v.direction.startsWith("savings");
    return true;
  }
  async function submit(v: Record<string, string>) {
    setError("");
    try {
      const meta = {
        ...metadata(),
        ...(row && "id" in row ? { id: row.id, createdAt: row.createdAt } : {}),
        updatedAt: new Date().toISOString(),
      };
      const amount = (key: string) => parseMoney(v[key] || "0");
      const nullable = (key: string) => v[key] || null;
      const recurringValues = {
        name: v.name,
        amountCents: amount("amountCents"),
        frequency: v.frequency,
        activeMonths: v.activeMonths
          ? v.activeMonths.split(",").map(Number)
          : [],
        dueDay: Number(v.dueDay),
        startDate: v.startDate,
        endDate: nullable("endDate"),
        archivedAt: null,
      };
      let result: unknown;
      switch (kind) {
        case "category":
          result = {
            ...meta,
            name: v.name,
            parentId: nullable("parentId"),
            type: "expense",
            sortOrder: +v.sortOrder,
            archivedAt: null,
          };
          break;
        case "expense":
          result = {
            ...meta,
            ...recurringValues,
            categoryId: v.categoryId,
            kind: v.kind,
            fundId: v.kind === "fixed" ? nullable("fundId") : null,
            notes: v.notes,
          };
          break;
        case "income":
          result = { ...meta, ...recurringValues, status: v.status };
          break;
        case "budget":
          result = {
            period,
            openingCashCents: amount("openingCashCents"),
            savingsTargetCents: amount("savingsTargetCents"),
            status: v.status,
            updatedAt: meta.updatedAt,
          };
          break;
        case "allocation":
          result = {
            ...meta,
            period,
            categoryId: v.categoryId,
            amountCents: amount("amountCents"),
            allocationType: "variable",
          };
          break;
        case "transaction":
          result = {
            ...meta,
            date: v.date,
            direction: v.direction,
            amountCents: amount("amountCents"),
            memo: v.memo,
            categoryId:
              v.direction === "expense" ? nullable("categoryId") : null,
            expenseRuleId:
              v.direction === "expense" ? nullable("expenseRuleId") : null,
            occurrenceDate:
              v.direction === "expense" && v.expenseRuleId
                ? nullable("occurrenceDate")
                : null,
            incomeRuleId:
              v.direction === "income" ? nullable("incomeRuleId") : null,
            fundId: v.direction === "expense" ? nullable("fundId") : null,
            goalId: v.direction.startsWith("savings")
              ? nullable("goalId")
              : null,
            source: data.settings.some(
              (s) => s.key === "demo" && s.value === true,
            )
              ? "demo"
              : "manual",
          };
          break;
        case "fund":
          result = {
            ...meta,
            name: v.name,
            targetCents: amount("targetCents"),
            monthlyCents: amount("monthlyCents"),
            startDate: v.startDate,
            dueDate: v.dueDate,
            active: v.active === "true",
          };
          break;
        case "goal":
          result = {
            ...meta,
            name: v.name,
            targetCents: amount("targetCents"),
            deadline: v.deadline,
            active: v.active === "true",
          };
          break;
        case "entry":
          result = {
            ...meta,
            fundId: v.fundId,
            date: v.date,
            entryType: v.entryType,
            amountCents: amount("amountCents"),
            transactionId: null,
          };
          break;
      }
      await repository.save<TableName>(
        tableFor[kind],
        result as Row<TableName>,
      );
      notify("Cambios guardados.");
      close();
    } catch (e) {
      setError(errorMessage(e));
    }
  }
  const isRecurring = kind === "expense" || kind === "income";
  let preview = "";
  if (isRecurring)
    try {
      const rule = {
        ...values,
        amountCents: parseMoney(values.amountCents || "0"),
        activeMonths: values.activeMonths
          ? values.activeMonths.split(",").map(Number)
          : [],
        dueDay: +values.dueDay,
        endDate: values.endDate || null,
        archivedAt: null,
      } as unknown as ExpenseRule;
      const dates = occurrences(rule, period);
      preview = `${dates.length} ${dates.length === 1 ? "cargo" : "cargos"} en ${monthNames[+period.slice(5) - 1].toLowerCase()}: ${money(rule.amountCents * dates.length)}.`;
    } catch {
      /* Field errors describe invalid input. */
    }
  return (
    <Modal
      title={`${row ? "Editar" : "Añadir"} ${titles[kind]}`}
      description={
        kind === "transaction"
          ? "Anota un cobro, un pago o una transferencia que ya hayas hecho."
          : "Los cambios se guardan en este dispositivo."
      }
      onClose={() => {
        if (!isSubmitting) close();
      }}
    >
      <form onSubmit={handleSubmit(submit)} className="editor-form" noValidate>
        {definitions[kind]
          .filter((f) => visible(f.key, values))
          .map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>
                {f.label}
                {f.optional && <span className="optional"> · opcional</span>}
              </label>
              {f.type === "select" ? (
                <select
                  id={f.key}
                  {...register(f.key)}
                  aria-invalid={!!errors[f.key]}
                  onChange={(e) => {
                    setValue(f.key, e.target.value, { shouldValidate: true });
                    if (f.key === "expenseRuleId") {
                      const rule = data.expenseRules.find(
                        (r) => r.id === e.target.value,
                      );
                      if (rule) {
                        setValue("categoryId", rule.categoryId);
                        setValue(
                          "occurrenceDate",
                          occurrences(rule, period)[0] || "",
                        );
                        if (!values.memo) setValue("memo", rule.name);
                        if (!values.amountCents)
                          setValue("amountCents", moneyInput(rule.amountCents));
                      }
                    }
                  }}
                >
                  <option value="">
                    {f.optional ? "Ninguno" : "Selecciona una opción"}
                  </option>
                  {f.options?.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  id={f.key}
                  {...register(f.key)}
                  rows={3}
                  maxLength={1000}
                />
              ) : (
                <input
                  id={f.key}
                  {...register(f.key)}
                  type={f.type === "date" ? "date" : "text"}
                  inputMode={
                    f.type === "money"
                      ? "decimal"
                      : f.type === "number"
                        ? "numeric"
                        : undefined
                  }
                  autoComplete="off"
                  aria-invalid={!!errors[f.key]}
                  aria-describedby={
                    errors[f.key]
                      ? `${f.key}-error`
                      : f.hint
                        ? `${f.key}-hint`
                        : undefined
                  }
                />
              )}
              {errors[f.key] && (
                <p id={`${f.key}-error`} className="field-error" role="alert">
                  {errors[f.key]?.message}
                </p>
              )}
              {f.hint && (
                <p id={`${f.key}-hint`} className="field-hint">
                  {f.hint}
                </p>
              )}
            </div>
          ))}
        {isRecurring && values.frequency !== "ONE_OFF" && (
          <fieldset className="field">
            <legend>Meses activos</legend>
            <p className="field-hint">
              Sin selección: todos los meses. Para «Solo algunos meses», elige
              al menos uno.
            </p>
            <div className="month-grid">
              {monthNames.map((name, i) => {
                const selected = values.activeMonths
                  .split(",")
                  .filter(Boolean)
                  .map(Number);
                return (
                  <button
                    type="button"
                    key={name}
                    aria-pressed={selected.includes(i + 1)}
                    className={selected.includes(i + 1) ? "selected" : ""}
                    onClick={() =>
                      setValue(
                        "activeMonths",
                        (selected.includes(i + 1)
                          ? selected.filter((m) => m !== i + 1)
                          : [...selected, i + 1]
                        )
                          .sort((a, b) => a - b)
                          .join(","),
                      )
                    }
                  >
                    {name.slice(0, 3)}
                  </button>
                );
              })}
            </div>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setValue("activeMonths", "1,2,3,4,5,6,9,10,11,12")}
            >
              Curso escolar · septiembre a junio
            </Button>
          </fieldset>
        )}
        {preview && (
          <div className="notice">
            {preview}{" "}
            {row &&
              "Los cambios no afectan a los cobros ni a los pagos ya anotados."}
          </div>
        )}
        {kind === "entry" && (
          <div className="notice">
            Una aportación es una reserva, no un gasto. Para pagar una factura
            con este dinero, registra un movimiento de gasto y selecciona el
            fondo.
          </div>
        )}
        {error && (
          <div className="notice error" role="alert">
            {error}
          </div>
        )}
        <div className="form-footer">
          <Button
            type="button"
            variant="secondary"
            onClick={close}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
export function transactionDefaults(
  rule: ExpenseRule,
  date: string,
  remaining: number,
): Record<string, string> {
  return {
    direction: "expense",
    memo: rule.name,
    amountCents: moneyInput(remaining),
    categoryId: rule.categoryId,
    expenseRuleId: rule.id,
    occurrenceDate: date,
    fundId: rule.fundId || "",
    date: today(),
  };
}
export function transactionLabel(direction: Transaction["direction"]) {
  return {
    income: "Ingreso cobrado",
    expense: "Gasto pagado",
    savings_in: "Aportación al ahorro",
    savings_out: "Retirada de ahorro",
  }[direction];
}
