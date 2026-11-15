import { useFinance } from "@/app/context";
import { fundBalance, summary } from "@/domain/finance";
import { money, sum } from "@/domain/money";
import {
  AddButton,
  Card,
  Empty,
  PageHeading,
  SectionTitle,
  Progress,
  RowActions,
} from "@/components/common";
import { Button } from "@/components/ui/button";
import { PiggyBank, Umbrella } from "lucide-react";
export function Savings() {
  const { data, period, open, remove } = useFinance();
  const s = summary(data, period);
  return (
    <>
      <PageHeading
        eyebrow="AHORRO Y RESERVAS"
        title="Ahorro y próximos gastos"
        description="Consulta cuánto has ahorrado y cuánto has reservado para gastos pendientes."
      />
      <div className="plan-summary">
        <div>
          <small>Objetivo de ahorro del mes</small>
          <strong>{money(s.savingsTarget)}</strong>
        </div>
        <div>
          <small>Ahorro realmente transferido</small>
          <strong>{money(s.actualSavings)}</strong>
        </div>
        <div>
          <small>Reservas previstas del mes</small>
          <strong>{money(s.provisions)}</strong>
        </div>
      </div>
      <SectionTitle title="Objetivos de ahorro">
        <AddButton onClick={() => open({ kind: "goal" })}>Objetivo</AddButton>
      </SectionTitle>
      <div className="fund-grid">
        {data.savingsGoals.map((g) => {
          const balance = sum(
            data.transactions
              .filter((t) => t.goalId === g.id)
              .map((t) =>
                t.direction === "savings_in" ? t.amountCents : -t.amountCents,
              ),
          );
          return (
            <Card key={g.id}>
              <div className="fund-heading">
                <span className="small-icon">
                  <PiggyBank />
                </span>
                <RowActions
                  name={g.name}
                  edit={() => open({ kind: "goal", row: g })}
                  remove={() => remove("savingsGoals", g.id, g.name)}
                />
              </div>
              <h2>{g.name}</h2>
              <p className="muted">
                Hasta {g.deadline.split("-").reverse().join("/")} ·{" "}
                {g.active ? "Activo" : "Pausado"}
              </p>
              <p className="fund-amount">
                {money(balance)} <span>de {money(g.targetCents)}</span>
              </p>
              <Progress
                value={g.targetCents ? (balance / g.targetCents) * 100 : 0}
                label={g.name}
              />
              <p className="field-hint">
                Transferencias registradas, menos retiradas. Acumulado de todos
                los meses.
              </p>
              <Button
                variant="secondary"
                onClick={() =>
                  open({
                    kind: "transaction",
                    defaults: {
                      direction: "savings_in",
                      goalId: g.id,
                      memo: `Ahorro: ${g.name}`,
                    },
                  })
                }
              >
                Registrar aportación
              </Button>
            </Card>
          );
        })}
        {!data.savingsGoals.length && (
          <Card>
            <Empty
              title="Aún no tienes objetivos de ahorro"
              description="Añade un objetivo: un fondo de emergencia, las vacaciones o una compra importante."
            />
          </Card>
        )}
      </div>
      <SectionTitle title="Fondos para gastos futuros">
        <AddButton onClick={() => open({ kind: "fund" })}>Fondo</AddButton>
      </SectionTitle>
      <p className="muted section-description">
        Una provisión es dinero reservado para un gasto que llegará después. No
        cuenta como gasto hasta que lo pagas.
      </p>
      <div className="fund-grid">
        {data.sinkingFunds.map((f) => {
          const balance = fundBalance(data, f.id);
          return (
            <Card key={f.id}>
              <div className="fund-heading">
                <span className="small-icon sand-bg">
                  <Umbrella />
                </span>
                <RowActions
                  name={f.name}
                  edit={() => open({ kind: "fund", row: f })}
                  remove={() => remove("sinkingFunds", f.id, f.name)}
                />
              </div>
              <h2>{f.name}</h2>
              <p className="muted">
                Previsto para {f.dueDate.split("-").reverse().join("/")} ·{" "}
                {f.active ? "Activo" : "Pausado"}
              </p>
              <p className="fund-amount">
                {money(balance)} <span>de {money(f.targetCents)}</span>
              </p>
              <Progress
                value={f.targetCents ? (balance / f.targetCents) * 100 : 0}
                label={f.name}
              />
              <p className="field-hint">
                Reserva prevista: {money(f.monthlyCents)}/mes. Saldo acumulado
                real de todos los meses.
              </p>
              <Button
                variant="secondary"
                onClick={() =>
                  open({ kind: "entry", defaults: { fundId: f.id } })
                }
              >
                Aportar o retirar
              </Button>
              <details className="fund-history">
                <summary>Ver aportaciones y pagos</summary>
                {data.fundEntries
                  .filter((e) => e.fundId === f.id)
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((e) => (
                    <div className="entry-row" key={e.id}>
                      <div>
                        <strong>
                          {e.entryType === "contribution"
                            ? "Aportación"
                            : e.entryType === "payment"
                              ? "Pago de gasto"
                              : "Retirada"}
                        </strong>
                        <small>{e.date}</small>
                      </div>
                      <span>
                        {e.entryType === "contribution" ? "+" : "−"}
                        {money(e.amountCents)}
                      </span>
                      {e.entryType !== "payment" && (
                        <RowActions
                          name={`aportación ${e.date}`}
                          edit={() => open({ kind: "entry", row: e })}
                          remove={() =>
                            remove("fundEntries", e.id, "esta aportación")
                          }
                        />
                      )}
                    </div>
                  ))}
              </details>
            </Card>
          );
        })}
        {!data.sinkingFunds.length && (
          <Card>
            <Empty
              title="Aún no has creado ningún fondo"
              description="Reserva dinero para el seguro del coche, la vuelta al cole o una reparación."
            />
          </Card>
        )}
      </div>
    </>
  );
}
