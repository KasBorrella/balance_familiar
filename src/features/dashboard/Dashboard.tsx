import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  CalendarDays,
  ShieldCheck,
  Wallet,
  PiggyBank,
  CircleHelp,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { useFinance } from "@/app/context";
import { summary } from "@/domain/finance";
import { money } from "@/domain/money";
import { today } from "@/domain/calendar";
import {
  Card,
  PageHeading,
  SectionTitle,
  Progress,
  Empty,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { transactionDefaults } from "@/components/editor";
import type { CSSProperties } from "react";
export function Dashboard() {
  const { data, period, open } = useFinance();
  const s = summary(data, period);
  const pending = s.payments.filter((p) => p.remaining > 0);
  const totalAssigned = s.plannedIncome - s.unallocated;
  const assignedPercent =
    s.plannedIncome > 0
      ? Math.round((totalAssigned / s.plannedIncome) * 100)
      : null;
  const chart = [
    {
      name: "Ingresos",
      Previsto: s.plannedIncome / 100,
      Real: s.actualIncome / 100,
    },
    {
      name: "Gastos",
      Previsto: s.plannedExpenses / 100,
      Real: s.actualExpense / 100,
    },
    {
      name: "Ahorro",
      Previsto: s.savingsTarget / 100,
      Real: s.actualSavings / 100,
    },
  ];
  return (
    <>
      <PageHeading
        eyebrow="CUENTAS DE CASA"
        title="Resumen del mes"
        description="Ingresos, gastos y lo que queda por repartir."
      />
      <div className="overview-grid">
        <section
          className={`balance-card ${s.unallocated < 0 ? "deficit" : ""}`}
        >
          <div className="balance-top">
            <span>
              <span className="status-dot" /> PRESUPUESTO MENSUAL
            </span>
            <Wallet size={23} />
          </div>
          <p className="balance-label">
            {s.unallocated < 0
              ? "Déficit del presupuesto"
              : "Sin asignar este mes"}
          </p>
          <div className="balance-amount" data-testid="unallocated">
            {money(s.unallocated)}
          </div>
          <p className="balance-description">
            {s.unallocated < 0
              ? "Has presupuestado más de lo que esperas ingresar."
              : "Pendiente de repartir entre gastos, reservas y ahorro."}
          </p>
          <div className="balance-foot">
            <span>
              {money(totalAssigned)} asignados de {money(s.plannedIncome)}
            </span>
            <Button asChild variant="secondary">
              <Link to="/planificar">
                Revisar presupuesto <ArrowUpRight size={17} />
              </Link>
            </Button>
          </div>
          <div
            className="budget-orbit"
            style={
              {
                "--assigned": `${Math.max(0, Math.min(100, assignedPercent ?? 0))}%`,
              } as CSSProperties
            }
            role="img"
            aria-label={
              assignedPercent === null
                ? "Sin ingresos previstos"
                : `${assignedPercent}% de los ingresos previstos ya asignados`
            }
          >
            <div>
              <strong>
                {assignedPercent === null ? "—" : `${assignedPercent}%`}
              </strong>
              <span>
                {assignedPercent === null ? "sin ingresos" : "asignado"}
              </span>
            </div>
          </div>
        </section>
        <Card className="month-note">
          <div className="small-icon">
            <ShieldCheck size={23} />
          </div>
          <h2>Gastos de los próximos meses</h2>
          <p className="muted">
            Seguros, vuelta al cole o reparaciones. Esto es lo que has previsto
            reservar este mes.
          </p>
          <div className="note-stat">
            <span>Reservas previstas</span>
            <strong>{money(s.provisions)}</strong>
          </div>
          <Link to="/ahorro" className="text-link">
            Ver mis fondos <ArrowRight size={16} />
          </Link>
        </Card>
      </div>
      <SectionTitle title="Cobrado y pagado">
        <span className="pill">Movimientos reales</span>
      </SectionTitle>
      <div className="stats-grid">
        <Card className="stat">
          <span className="stat-icon green">
            <ArrowDownLeft />
          </span>
          <div>
            <p>Ingresos cobrados</p>
            <strong>{money(s.actualIncome)}</strong>
            <small>Previstos: {money(s.plannedIncome)}</small>
          </div>
        </Card>
        <Card className="stat">
          <span className="stat-icon peach">
            <ArrowUpRight />
          </span>
          <div>
            <p>Gastos pagados</p>
            <strong>{money(s.actualExpense)}</strong>
            <small>Fijos previstos: {money(s.fixed)}</small>
          </div>
        </Card>
        <Card className="stat">
          <span className="stat-icon lavender">
            <PiggyBank />
          </span>
          <div>
            <p>Ahorro transferido</p>
            <strong className={s.actualSavings < 0 ? "negative" : ""}>
              {money(s.actualSavings)}
            </strong>
            <small>Objetivo: {money(s.savingsTarget)}</small>
          </div>
        </Card>
      </div>
      <p className="financial-note">
        Resultado real de caja: <strong>{money(s.net)}</strong> · Gastos
        variables pagados: <strong>{money(s.actualVariable)}</strong> de{" "}
        {money(s.variableBudget)} previstos.
      </p>
      <div className="dashboard-columns">
        <div>
          <Card>
            <SectionTitle title="Reparto del presupuesto">
              <Link to="/planificar" className="text-link">
                Ver detalle <ArrowUpRight size={16} />
              </Link>
            </SectionTitle>
            <p className="card-subtitle">
              Reparto de los ingresos previstos para este mes.
            </p>
            <div className="allocation-bar" aria-label="Distribución prevista">
              {[
                { v: s.fixed - s.funded, c: "var(--teal)" },
                { v: s.variableBudget, c: "var(--chart-variable)" },
                { v: s.provisions, c: "var(--chart-funds)" },
                { v: s.savingsTarget, c: "var(--chart-savings)" },
                { v: Math.max(0, s.unallocated), c: "var(--surface-muted)" },
              ].map((p, i) => (
                <span
                  key={i}
                  style={{ flex: Math.max(0, p.v), background: p.c }}
                />
              ))}
            </div>
            <div className="breakdown">
              {[
                ["Obligaciones del mes", s.fixed - s.funded, "teal"],
                ["Presupuesto variable", s.variableBudget, "sage"],
                ["Fondos para gastos futuros", s.provisions, "lime"],
                ["Objetivo de ahorro", s.savingsTarget, "sand"],
              ].map(([label, value, c]) => (
                <Link
                  key={label}
                  to={c === "lime" || c === "sand" ? "/ahorro" : "/planificar"}
                >
                  <span>
                    <i className={`legend-dot ${c}`} />
                    {label}
                  </span>
                  <strong>{money(Number(value))}</strong>
                </Link>
              ))}
            </div>
            {s.funded > 0 && (
              <p className="field-hint">
                Pagos fijos: {money(s.fixed)}. De ellos, {money(s.funded)} se
                prevén cubiertos con fondos.
              </p>
            )}
            <div className="subtle-footer">
              <CircleHelp size={16} /> El dinero sin asignar todavía no es
              ahorro.
            </div>
          </Card>
          <Card className="chart-card">
            <SectionTitle title="Previsión y gasto real">
              <div className="chart-legend">
                <span>
                  <i className="legend-dot pale" />
                  Previsto
                </span>
                <span>
                  <i className="legend-dot teal" />
                  Real
                </span>
              </div>
            </SectionTitle>
            <div
              className="chart"
              role="img"
              aria-label={`Comparación mensual: ingresos previstos ${money(s.plannedIncome)}, reales ${money(s.actualIncome)}; gastos previstos ${money(s.plannedExpenses)}, reales ${money(s.actualExpense)}; ahorro objetivo ${money(s.savingsTarget)}, transferido ${money(s.actualSavings)}.`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chart}
                  barGap={6}
                  margin={{ top: 12, right: 5, left: -10, bottom: 0 }}
                >
                  <CartesianGrid
                    vertical={false}
                    stroke="var(--border)"
                    strokeDasharray="3 3"
                  />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: "var(--muted)" }}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "var(--muted)" }}
                    tickFormatter={(v) => `${v} €`}
                  />
                  <Tooltip
                    formatter={(v) => money(Math.round(Number(v) * 100))}
                    cursor={{ fill: "var(--surface-muted)" }}
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 12,
                      color: "var(--foreground)",
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                    labelStyle={{ color: "var(--foreground)" }}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="Previsto"
                    fill="var(--chart-planned)"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={35}
                  />
                  <Bar
                    isAnimationActive={false}
                    dataKey="Real"
                    fill="var(--teal)"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={35}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
        <div>
          <Card>
            <SectionTitle title="Pagos del mes">
              <CalendarDays size={19} className="muted" />
            </SectionTitle>
            <p className="card-subtitle">
              {pending.length
                ? `${pending.length} pagos pendientes de anotar`
                : "Todos los pagos del mes están anotados"}
            </p>
            {pending.length === 0 ? (
              <Empty
                title="Sin pagos pendientes"
                description="Los gastos que planifiques aparecerán aquí."
              />
            ) : (
              <div className="payment-list">
                {pending.slice(0, 5).map(({ rule, date, remaining }) => (
                  <div className="payment" key={`${rule.id}-${date}`}>
                    <span className="date-tile">
                      {date.slice(8)}
                      <small>
                        {new Intl.DateTimeFormat("es-ES", {
                          month: "short",
                          timeZone: "UTC",
                        })
                          .format(new Date(`${date}T12:00:00Z`))
                          .replace(".", "")}
                      </small>
                    </span>
                    <div>
                      <strong>{rule.name}</strong>
                      <small>
                        {date < today() ? "Vencido · sin anotar" : "Previsto"}
                        {rule.fundId ? " · con fondo" : ""}
                      </small>
                    </div>
                    <div className="payment-amount">
                      <strong>{money(remaining)}</strong>
                      <button
                        className="text-link"
                        onClick={() =>
                          open({
                            kind: "transaction",
                            defaults: transactionDefaults(
                              rule,
                              date,
                              remaining,
                            ),
                          })
                        }
                      >
                        Registrar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Link to="/planificar?tab=calendario" className="wide-link">
              Ver calendario del mes <ArrowRight size={16} />
            </Link>
          </Card>
          <Card>
            <SectionTitle title="Gasto por categoría" />
            <p className="card-subtitle">Presupuestos variables · gasto real</p>
            {s.allocationStats.length === 0 ? (
              <p className="muted">
                Añade un presupuesto por categoría para seguir tus gastos.
              </p>
            ) : (
              s.allocationStats.map((a) => (
                <div className="budget-mini" key={a.id}>
                  <div>
                    <strong>{a.name}</strong>
                    <span>
                      {money(a.actual)} <small>/ {money(a.amountCents)}</small>
                    </span>
                  </div>
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
                  <small
                    className={a.actual > a.amountCents ? "negative" : "muted"}
                  >
                    {a.actual > a.amountCents
                      ? `Exceso real: ${money(a.actual - a.amountCents)}`
                      : `Quedan ${money(a.amountCents - a.actual)}`}
                  </small>
                  {a.planned > a.amountCents && (
                    <small className="negative">
                      Exceso previsto: {money(a.planned - a.amountCents)}
                    </small>
                  )}
                </div>
              ))
            )}
          </Card>
          <div className="local-note">
            <ShieldCheck size={17} />
            <span>
              Datos guardados en este dispositivo. Sin sincronización bancaria.
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
