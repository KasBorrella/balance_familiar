import { useSearchParams } from "react-router-dom";
import { CalendarDays, Plus, ArrowUpRight } from "lucide-react";
import { useFinance } from "@/app/context";
import { summary } from "@/domain/finance";
import { money, moneyInput } from "@/domain/money";
import { frequencyLabels, occurrences } from "@/domain/calendar";
import { ExpenseTree } from "@/features/expenses/ExpenseTree";
import {
  AddButton,
  Card,
  PageHeading,
  SectionTitle,
  RowActions,
  Empty,
  Progress,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { transactionDefaults } from "@/components/editor";
export function Planning() {
  const { data, period, open, remove } = useFinance();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "presupuesto";
  const s = summary(data, period);
  const budget = data.monthlyBudgets.find((b) => b.period === period);
  return (
    <>
      <PageHeading
        eyebrow="PLANIFICACIÓN"
        title="Presupuesto mensual"
        description="Prepara los gastos del mes con los ingresos que esperas cobrar."
      />
      <div className="tabs" role="tablist" aria-label="Planificación">
        {[
          ["presupuesto", "Presupuesto"],
          ["gastos", "Gastos previstos"],
          ["ingresos", "Ingresos previstos"],
          ["calendario", "Calendario"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => setParams({ tab: id })}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "presupuesto" && (
        <>
          <div className="plan-summary">
            <div>
              <small>Ingresos previstos</small>
              <strong>{money(s.plannedIncome)}</strong>
            </div>
            <div>
              <small>Asignados</small>
              <strong>{money(s.plannedIncome - s.unallocated)}</strong>
            </div>
            <div>
              <small>{s.unallocated < 0 ? "Déficit" : "Sin asignar"}</small>
              <strong className={s.unallocated < 0 ? "negative" : "positive"}>
                {money(s.unallocated)}
              </strong>
            </div>
          </div>
          {s.unallocated < 0 && (
            <div className="notice error" role="alert">
              Déficit de {money(s.unallocated)}. Revisa obligaciones (
              {money(s.fixed - s.funded)}), presupuesto variable (
              {money(s.variableBudget)}), reservas ({money(s.provisions)}) y
              objetivo de ahorro ({money(s.savingsTarget)}).
            </div>
          )}
          <div className="two-columns">
            <Card>
              <SectionTitle title="Datos del presupuesto">
                <Button
                  variant="ghost"
                  onClick={() => open({ kind: "budget", row: budget })}
                >
                  Editar <ArrowUpRight size={16} />
                </Button>
              </SectionTitle>
              <dl className="detail-list">
                <div>
                  <dt>Saldo inicial de caja</dt>
                  <dd>{money(budget?.openingCashCents || 0)}</dd>
                </div>
                <div>
                  <dt>Obligaciones fijas previstas</dt>
                  <dd>{money(s.fixed)}</dd>
                </div>
                <div>
                  <dt>Parte cubierta con fondos</dt>
                  <dd>{money(s.funded)}</dd>
                </div>
                <div>
                  <dt>Aportaciones previstas a fondos</dt>
                  <dd>{money(s.provisions)}</dd>
                </div>
                <div>
                  <dt>Objetivo mensual de ahorro</dt>
                  <dd>{money(s.savingsTarget)}</dd>
                </div>
              </dl>
              <p className="field-hint">
                {budget?.status === "ready"
                  ? "Plan revisado."
                  : "Plan en preparación."}{" "}
                Las aportaciones y el ahorro previstos no crean movimientos
                reales.
              </p>
            </Card>
            <Card>
              <SectionTitle title="Caja del mes">
                <span className="pill">Real</span>
              </SectionTitle>
              <dl className="detail-list">
                <div>
                  <dt>Ingresos cobrados</dt>
                  <dd>{money(s.actualIncome)}</dd>
                </div>
                <div>
                  <dt>Gastos pagados</dt>
                  <dd>{money(s.actualExpense)}</dd>
                </div>
                <div>
                  <dt>Resultado de caja</dt>
                  <dd>{money(s.net)}</dd>
                </div>
                <div>
                  <dt>Saldo inicial + resultado</dt>
                  <dd>{money(s.availableCash)}</dd>
                </div>
              </dl>
              <p className="field-hint">
                Vista global de caja: incluye el dinero reservado en fondos y
                ahorro; no descuenta compromisos futuros. No es un saldo
                bancario sincronizado.
              </p>
            </Card>
          </div>
          <Card>
            <SectionTitle title="Presupuestos variables">
              <AddButton onClick={() => open({ kind: "allocation" })}>
                Añadir presupuesto
              </AddButton>
            </SectionTitle>
            <p className="card-subtitle">
              Un límite por categoría. Los gastos fijos se calculan aparte.
            </p>
            {s.allocationStats.length ? (
              s.allocationStats.map((a) => (
                <div className="allocation-row" key={a.id}>
                  <div>
                    <strong>{a.name}</strong>
                    <p className="muted">
                      {money(a.actual)} gastados · {money(a.amountCents)}{" "}
                      presupuestados
                    </p>
                    <Progress
                      value={
                        a.amountCents
                          ? (a.actual / a.amountCents) * 100
                          : a.actual
                            ? 101
                            : 0
                      }
                      label={a.name}
                    />
                    {a.actual > a.amountCents && (
                      <p className="field-error">
                        Exceso real: {money(a.actual - a.amountCents)}
                      </p>
                    )}
                    {a.planned > a.amountCents && (
                      <p className="field-error">
                        Exceso previsto: {money(a.planned - a.amountCents)}
                      </p>
                    )}
                  </div>
                  <RowActions
                    name={a.name}
                    edit={() =>
                      open({
                        kind: "allocation",
                        row: data.budgetAllocations.find((b) => b.id === a.id),
                      })
                    }
                    remove={() => remove("budgetAllocations", a.id, a.name)}
                  />
                </div>
              ))
            ) : (
              <Empty
                title="Aún no hay límites de gasto"
                description="Añade límites para alimentación, ocio u otros gastos variables."
              />
            )}
          </Card>
        </>
      )}
      {tab === "gastos" && (
        <Card>
          <SectionTitle title="Gastos por categoría">
            <div className="inline-actions">
              <Button
                variant="secondary"
                onClick={() => open({ kind: "category" })}
              >
                <Plus size={16} />
                Categoría
              </Button>
              <AddButton onClick={() => open({ kind: "expense" })}>
                Gasto
              </AddButton>
            </div>
          </SectionTitle>
          <p className="card-subtitle">
            Abre una categoría para ver sus conceptos. Total fijo del mes:{" "}
            <strong data-testid="fixed-total">{money(s.fixed)}</strong>.
          </p>
          <ExpenseTree />
        </Card>
      )}
      {tab === "ingresos" && (
        <Card>
          <SectionTitle title="Ingresos previstos">
            <AddButton onClick={() => open({ kind: "income" })}>
              Ingreso previsto
            </AddButton>
          </SectionTitle>
          <p className="card-subtitle">
            Previsión mensual: {money(s.plannedIncome)}. Confirmar una previsión
            no registra un cobro.
          </p>
          {data.incomeRules.length ? (
            data.incomeRules.map((r) => (
              <div className="expense-row" key={r.id}>
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {frequencyLabels[r.frequency]} ·{" "}
                    {r.status === "confirmed" ? "Confirmado" : "Estimado"}
                  </small>
                </div>
                <strong>
                  {money(occurrences(r, period).length * r.amountCents)}
                </strong>
                <Button
                  variant="ghost"
                  onClick={() =>
                    open({
                      kind: "transaction",
                      defaults: {
                        direction: "income",
                        incomeRuleId: r.id,
                        memo: r.name,
                        amountCents: moneyInput(r.amountCents),
                      },
                    })
                  }
                >
                  Registrar cobro
                </Button>
                <RowActions
                  name={r.name}
                  edit={() => open({ kind: "income", row: r })}
                  remove={() => remove("incomeRules", r.id, r.name)}
                />
              </div>
            ))
          ) : (
            <Empty
              title="Aún no hay ingresos previstos"
              description="Añade una nómina, una ayuda o cualquier ingreso previsto."
            />
          )}
        </Card>
      )}
      {tab === "calendario" && (
        <Card>
          <SectionTitle title="Calendario de pagos">
            <CalendarDays size={22} />
          </SectionTitle>
          <p className="card-subtitle">
            Vencimientos del mes elegido. Los pagos se marcan al vincular un
            movimiento.
          </p>
          {s.payments.length ? (
            s.payments.map((p) => (
              <div className="expense-row" key={`${p.rule.id}-${p.date}`}>
                <span className="date-tile">{p.date.slice(8)}</span>
                <div>
                  <strong>{p.rule.name}</strong>
                  <small>
                    {p.date} ·{" "}
                    {p.remaining === 0
                      ? "Registrado"
                      : p.paid > 0
                        ? "Parcialmente pagado"
                        : "Pendiente de registrar"}
                  </small>
                </div>
                <strong>{money(p.rule.amountCents)}</strong>
                {p.remaining > 0 && (
                  <Button
                    variant="secondary"
                    onClick={() =>
                      open({
                        kind: "transaction",
                        defaults: transactionDefaults(
                          p.rule,
                          p.date,
                          p.remaining,
                        ),
                      })
                    }
                  >
                    Registrar pago
                  </Button>
                )}
              </div>
            ))
          ) : (
            <Empty
              title="No hay pagos previstos este mes"
              description="Los gastos previstos aparecerán en sus fechas de vencimiento."
            />
          )}
        </Card>
      )}
    </>
  );
}
