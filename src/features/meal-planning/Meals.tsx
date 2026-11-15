import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  ChefHat,
  Clock,
  Plus,
  Users,
  Utensils,
} from "lucide-react";
import { useFinance } from "@/app/context";
import { repository } from "@/db/repository";
import { slots, slotLabels } from "@/domain/meal-models";
import {
  consolidateIngredients,
  entryReasons,
  planCost,
  planDates,
  portions,
} from "@/domain/meals";
import { money } from "@/domain/money";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/dialog";
import {
  Card,
  Empty,
  PageHeading,
  RowActions,
  SectionTitle,
} from "@/components/common";
import { errorMessage } from "@/components/editor";
import { MealEditor, type MealEdit } from "./MealEditor";
import { fillPlan } from "./service";
import { addMealDemo } from "./demo";

const dateLabel = (date: string) =>
  new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
export function Meals() {
  const { data, notify, remove } = useFinance();
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "calendario";
  const [edit, setEdit] = useState<MealEdit | null>(null);
  const [busy, setBusy] = useState(false);
  const [clearDemo, setClearDemo] = useState(false);
  const [report, setReport] = useState<{
    planId: string;
    text: string;
    gaps: string[];
  } | null>(null);
  const [query, setQuery] = useState("");
  const [week, setWeek] = useState(0);
  const [view, setView] = useState<"week" | "all">("week");
  const plan =
    data.mealPlans.find((p) => p.id === params.get("plan")) ??
    [...data.mealPlans].sort((a, b) =>
      b.startDate.localeCompare(a.startDate),
    )[0];
  const entries = data.mealEntries.filter((e) => e.mealPlanId === plan?.id);
  const cost = planCost(data, entries);
  const dates = plan ? planDates(plan) : [];
  const currentWeek = Math.min(
    week,
    Math.max(0, Math.ceil(dates.length / 7) - 1),
  );
  const visibleDates =
    view === "all" ? dates : dates.slice(currentWeek * 7, currentWeek * 7 + 7);
  const active = data.householdMembers.filter((m) => m.active);
  const mealDemo = data.settings.some(
    (s) => s.key === "mealDemo" && s.value === true,
  );
  const empty =
    !data.householdMembers.length &&
    !data.ingredients.length &&
    !data.recipes.length &&
    !data.mealPlans.length;
  const changeTab = (tab: string) => {
    setParams({ tab, ...(plan ? { plan: plan.id } : {}) });
    setQuery("");
  };
  return (
    <div className="meals-page">
      <Link className="btn btn-secondary" to="/compra">
        Lista de compra y despensa
      </Link>
      <PageHeading
        eyebrow="EN CASA"
        title="Qué comemos"
        description="Organiza las comidas, guarda tus recetas y calcula lo que necesitas."
        action={
          <Button onClick={() => setEdit({ kind: "plan" })}>
            <Plus size={18} />
            Crear menú
          </Button>
        }
      />
      <div className="meal-hero">
        <div>
          <span className="eyebrow">LA SEMANA, A TU GUSTO</span>
          <h2>Menos vueltas al menú.</h2>
          <p>
            Elige los platos de siempre o completa los huecos con tus recetas.
          </p>
        </div>
        <div className="meal-hero-stats">
          <Users />
          <strong>{active.length}</strong>
          <span>en casa</span>
          <ChefHat />
          <strong>{data.recipes.length}</strong>
          <span>recetas</span>
        </div>
      </div>
      {mealDemo && (
        <div className="notice">
          Ejemplo ficticio: familia, recetas y costes orientativos para probar
          el planificador.{" "}
          <Button variant="ghost" onClick={() => setClearDemo(true)}>
            Empezar mi planificador desde cero
          </Button>
        </div>
      )}
      <div className="tabs" role="tablist" aria-label="Planificador de comidas">
        {[
          ["calendario", "Calendario"],
          ["recetas", "Recetas"],
          ["familia", "Familia"],
          ["ingredientes", "Ingredientes"],
        ].map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            onClick={() => changeTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {empty && (
        <Card>
          <Empty
            title="Vamos a preparar el primer menú"
            description="Añade las personas que comen en casa, sus preferencias y tus recetas. Si prefieres probar antes, carga el ejemplo ficticio."
            action={
              <div className="inline-actions">
                <Button
                  onClick={() => {
                    changeTab("familia");
                    setEdit({ kind: "member" });
                  }}
                >
                  Añadir persona
                </Button>
                <Button
                  variant="secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await repository.mutate(addMealDemo);
                      notify("Ejemplo ficticio cargado.");
                    } catch (e) {
                      notify(errorMessage(e), true);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Cargar ejemplo ficticio
                </Button>
              </div>
            }
          />
        </Card>
      )}
      {tab === "calendario" && (
        <>
          {!plan && !empty && (
            <Card>
              <Empty
                title="Todavía no hay ningún menú"
                description="Empieza con una semana o prepara hasta 31 días."
                action={
                  <Button onClick={() => setEdit({ kind: "plan" })}>
                    Crear menú
                  </Button>
                }
              />
            </Card>
          )}
          {plan && (
            <>
              <Card>
                <div className="meal-toolbar">
                  <label className="field">
                    <span>Menú seleccionado</span>
                    <select
                      value={plan.id}
                      onChange={(e) => {
                        setParams({ tab, plan: e.target.value });
                        setWeek(0);
                      }}
                    >
                      {[...data.mealPlans]
                        .sort((a, b) => b.startDate.localeCompare(a.startDate))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {dateLabel(p.startDate)} – {dateLabel(p.endDate)} ·{" "}
                            {p.status === "ready" ? "Preparado" : "Borrador"}
                          </option>
                        ))}
                    </select>
                  </label>
                  <RowActions
                    name="menú"
                    edit={() => setEdit({ kind: "plan", id: plan.id })}
                    remove={() =>
                      remove(
                        "mealPlans",
                        plan.id,
                        "este menú y todas sus comidas",
                      )
                    }
                  />
                  <Button
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const result = await fillPlan(plan.id);
                        setReport({
                          planId: plan.id,
                          text: `${result.added} comidas añadidas. ${result.gaps.length ? `${result.gaps.length} huecos siguen pendientes.` : "No quedan huecos para las comidas que hacéis en casa."}`,
                          gaps: result.gaps,
                        });
                      } catch (e) {
                        notify(errorMessage(e), true);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Utensils size={17} />
                    {busy ? "Preparando…" : "Proponer platos"}
                  </Button>
                </div>
                <div className="meal-summary">
                  <div>
                    <small>Comidas anotadas</small>
                    <strong>{entries.length}</strong>
                  </div>
                  <div>
                    <small>
                      Coste estimado{" "}
                      {cost.missing ? "parcial" : "de las recetas"}
                    </small>
                    <strong>{money(cost.cents)}</strong>
                  </div>
                  <div>
                    <small>Límite del menú</small>
                    <strong>
                      {plan.budgetCents === null
                        ? "Sin fijar"
                        : money(plan.budgetCents)}
                    </strong>
                  </div>
                  <div>
                    <small>Tiempo por receta</small>
                    <strong>{plan.maxMinutes} min</strong>
                  </div>
                </div>
                <p className="field-hint">
                  {cost.missing
                    ? `${cost.missing} comidas sin coste estimado. `
                    : ""}
                  Importes orientativos, calculados para las raciones anotadas.
                  No incluyen envases ni despensa. Las propuestas conservan lo
                  que ya has elegido.
                </p>
                {plan.budgetCents !== null && cost.cents > plan.budgetCents && (
                  <p className="notice error" role="alert">
                    El coste estimado supera el límite en{" "}
                    {money(cost.cents - plan.budgetCents)}.
                  </p>
                )}
                {!active.length && (
                  <p className="notice">
                    Añade una persona activa en Familia para poder proponer
                    platos.
                  </p>
                )}
                {report?.planId === plan.id && (
                  <div className="notice" role="status">
                    <strong>{report.text}</strong>
                    {report.gaps.length > 0 && (
                      <details>
                        <summary>Ver qué falta</summary>
                        <ul>
                          {report.gaps.map((g) => (
                            <li key={g}>
                              {g
                                .replace("breakfast", "desayuno")
                                .replace("lunch", "comida")
                                .replace("dinner", "cena")}
                            </li>
                          ))}
                        </ul>
                        <p>
                          Prueba a añadir recetas, revisar sus costes o ampliar
                          el tiempo disponible. Esta propuesta es una selección
                          sencilla, no un optimizador de todas las combinaciones
                          posibles.
                        </p>
                      </details>
                    )}
                  </div>
                )}
              </Card>
              <div className="meal-toolbar meal-calendar-controls">
                <div className="inline-actions">
                  <Button
                    variant={view === "week" ? "default" : "secondary"}
                    onClick={() => setView("week")}
                  >
                    Semana
                  </Button>
                  <Button
                    variant={view === "all" ? "default" : "secondary"}
                    onClick={() => setView("all")}
                  >
                    Todo el menú
                  </Button>
                </div>
                {view === "week" && (
                  <div className="inline-actions">
                    <Button
                      variant="ghost"
                      aria-label="Semana anterior"
                      disabled={currentWeek === 0}
                      onClick={() => setWeek(currentWeek - 1)}
                    >
                      ←
                    </Button>
                    <span>
                      Semana {currentWeek + 1} de {Math.ceil(dates.length / 7)}
                    </span>
                    <Button
                      variant="ghost"
                      aria-label="Semana siguiente"
                      disabled={(currentWeek + 1) * 7 >= dates.length}
                      onClick={() => setWeek(currentWeek + 1)}
                    >
                      →
                    </Button>
                  </div>
                )}
              </div>
              <div className="meal-calendar">
                {visibleDates.map((date) => (
                  <section className="meal-day" key={date}>
                    <h3>
                      <CalendarDays size={16} />
                      {dateLabel(date)}
                    </h3>
                    {slots.map((slot) => {
                      const entry = entries.find(
                        (e) => e.date === date && e.slot === slot,
                      );
                      const recipe = data.recipes.find(
                        (r) => r.id === entry?.recipeId,
                      );
                      const warnings = entry
                        ? entryReasons(data, plan, entry)
                        : [];
                      return (
                        <div
                          key={slot}
                          className={`meal-cell ${warnings.length ? "meal-conflict" : ""}`}
                        >
                          <span className="meal-slot">{slotLabels[slot]}</span>
                          {entry && recipe ? (
                            <>
                              <strong>{recipe.name}</strong>
                              <small>
                                <Clock size={13} />
                                {recipe.minutes} min · {entry.servings} raciones
                              </small>
                              {recipe.source === "demo" && (
                                <small>Receta de ejemplo</small>
                              )}
                              {warnings.length > 0 && (
                                <p className="field-error">
                                  Revisar: {warnings.join(" ")}
                                </p>
                              )}
                              <RowActions
                                name={`${slotLabels[slot]} del ${date}`}
                                edit={() =>
                                  setEdit({
                                    kind: "meal",
                                    id: entry.id,
                                    plan,
                                    date,
                                    slot,
                                  })
                                }
                                remove={() =>
                                  remove(
                                    "mealEntries",
                                    entry.id,
                                    "esta comida del menú",
                                  )
                                }
                              />
                            </>
                          ) : portions(data, slot) ? (
                            <Button
                              variant="ghost"
                              aria-label={`Elegir ${slotLabels[slot].toLowerCase()} del ${date}`}
                              onClick={() =>
                                setEdit({ kind: "meal", plan, date, slot })
                              }
                            >
                              <Plus size={16} />
                              Elegir plato
                            </Button>
                          ) : (
                            <p className="muted">No se hace en casa</p>
                          )}
                        </div>
                      );
                    })}
                  </section>
                ))}
              </div>
              <Card>
                <SectionTitle title="Ingredientes para todo el menú" />
                <p className="muted">
                  Cantidades ajustadas a las raciones. Se redondea hacia arriba
                  al sumar; todavía no se descuenta la despensa ni se calculan
                  envases.
                </p>
                {entries.length ? (
                  <div className="meal-ingredients-total">
                    {consolidateIngredients(data, entries).map(
                      ({ ingredient, quantity }) => (
                        <div key={ingredient.id}>
                          <span>{ingredient.name}</span>
                          <strong>
                            {quantity.toLocaleString("es-ES")}{" "}
                            {ingredient.baseUnit}
                          </strong>
                        </div>
                      ),
                    )}
                  </div>
                ) : (
                  <p>Elige algún plato para ver las cantidades.</p>
                )}
              </Card>
            </>
          )}
        </>
      )}
      {tab === "familia" && (
        <Card>
          <SectionTitle title="Quién come en casa">
            <Button onClick={() => setEdit({ kind: "member" })}>
              Añadir persona
            </Button>
          </SectionTitle>
          <p className="muted">
            Las alergias impiden asignar recetas incompatibles. Comprueba
            siempre las etiquetas y la posible contaminación cruzada.
          </p>
          {!data.householdMembers.length && (
            <p>Todavía no has añadido a nadie.</p>
          )}
          {data.householdMembers.map((m) => (
            <div className="meal-record" key={m.id}>
              <div>
                <strong>{m.alias}</strong>
                <small>
                  {m.type === "adult" ? "Adulto" : "Niño"} · {m.portionsFactor}{" "}
                  raciones ·{" "}
                  {m.active
                    ? m.mealsAtHome.map((s) => slotLabels[s]).join(", ")
                    : "No cuenta para los menús"}
                </small>
                <small>
                  Alergias: {m.restrictions.join(", ") || "ninguna indicada"}
                </small>
                {m.preferences.length > 0 && (
                  <small>Prefiere evitar: {m.preferences.join(", ")}</small>
                )}
              </div>
              <RowActions
                name={m.alias}
                edit={() => setEdit({ kind: "member", id: m.id })}
                remove={() => remove("householdMembers", m.id, m.alias)}
              />
            </div>
          ))}
          <p className="field-hint">
            Si cambias las personas o sus restricciones, revisa los avisos de
            los menús que ya tengas. Los platos guardados no se sustituyen
            automáticamente.
          </p>
        </Card>
      )}
      {tab === "recetas" && (
        <>
          <Card>
            <SectionTitle title="Tus recetas">
              <Button onClick={() => setEdit({ kind: "recipe" })}>
                Añadir receta
              </Button>
            </SectionTitle>
            <label className="field">
              <span>Buscar receta</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Por nombre o grupo de alimentos"
              />
            </label>
          </Card>
          <div className="meal-recipe-grid">
            {data.recipes
              .filter((r) =>
                `${r.name} ${r.foodGroups.join(" ")}`
                  .toLocaleLowerCase("es")
                  .includes(query.toLocaleLowerCase("es")),
              )
              .map((r) => (
                <Card key={r.id} className="meal-recipe">
                  <div className="meal-recipe-heading">
                    <span className="small-icon">
                      <ChefHat />
                    </span>
                    <RowActions
                      name={r.name}
                      edit={() => setEdit({ kind: "recipe", id: r.id })}
                      remove={() => remove("recipes", r.id, r.name)}
                    />
                  </div>
                  <h2>{r.name}</h2>
                  <p>
                    {r.minutes} min · {r.servings} raciones · {r.method}
                  </p>
                  <div className="meal-tags">
                    {r.mealType.map((s) => (
                      <span key={s}>{slotLabels[s]}</span>
                    ))}
                    {r.source === "demo" && <span>Ejemplo ficticio</span>}
                  </div>
                  <p className="muted">
                    {r.estimatedCostCents === null
                      ? "Sin coste estimado"
                      : `${money(r.estimatedCostCents)} por receta (estimación)`}{" "}
                    · Máximo {r.maxRepeat} veces en siete días
                  </p>
                  <details>
                    <summary>Ingredientes y preparación</summary>
                    <ul>
                      {data.recipeIngredients
                        .filter((i) => i.recipeId === r.id)
                        .map((i) => {
                          const ingredient = data.ingredients.find(
                            (n) => n.id === i.ingredientId,
                          )!;
                          return (
                            <li key={i.id}>
                              {i.quantityBase} {ingredient.baseUnit} de{" "}
                              {ingredient.name}
                            </li>
                          );
                        })}
                    </ul>
                    <p className="meal-instructions">{r.instructions}</p>
                    {r.substitutions && <p>Sustituciones: {r.substitutions}</p>}
                    <p>
                      Alérgenos declarados:{" "}
                      {[
                        ...new Set([
                          ...r.allergens,
                          ...data.recipeIngredients
                            .filter((i) => i.recipeId === r.id)
                            .flatMap(
                              (i) =>
                                data.ingredients.find(
                                  (n) => n.id === i.ingredientId,
                                )!.allergens,
                            ),
                        ]),
                      ].join(", ") || "ninguno"}
                      .
                    </p>
                    {r.foodGroups.length > 0 && (
                      <p>Grupos: {r.foodGroups.join(", ")}</p>
                    )}
                  </details>
                </Card>
              ))}
          </div>
          {!data.recipes.length && (
            <Card>
              <p>Añade primero los ingredientes y después tu primera receta.</p>
            </Card>
          )}
        </>
      )}
      {tab === "ingredientes" && (
        <Card>
          <SectionTitle title="Ingredientes de las recetas">
            <Button onClick={() => setEdit({ kind: "ingredient" })}>
              Añadir ingrediente
            </Button>
          </SectionTitle>
          <p className="muted">
            Usa nombres concretos, como «arroz crudo» o «garbanzos cocidos».
            Cada ingrediente tiene una unidad para poder sumar bien las
            cantidades.
          </p>
          {!data.ingredients.length && <p>Todavía no hay ingredientes.</p>}
          {[...data.ingredients]
            .sort((a, b) => a.name.localeCompare(b.name, "es"))
            .map((i) => (
              <div className="meal-record" key={i.id}>
                <div>
                  <strong>{i.name}</strong>
                  <small>
                    {i.baseUnit} · Alérgenos:{" "}
                    {i.allergens.join(", ") || "ninguno indicado"}
                  </small>
                </div>
                <RowActions
                  name={i.name}
                  edit={() => setEdit({ kind: "ingredient", id: i.id })}
                  remove={() => remove("ingredients", i.id, i.name)}
                />
              </div>
            ))}
        </Card>
      )}
      {edit && (
        <MealEditor
          key={`${edit.kind}-${edit.id ?? "new"}`}
          request={edit}
          close={() => setEdit(null)}
        />
      )}
      {clearDemo && (
        <Modal
          title="¿Vaciar el planificador de comidas?"
          description="Se borrarán la familia, las recetas, los ingredientes y los menús, incluidos tus cambios en el ejemplo. Los datos financieros se conservarán."
          onClose={() => {
            if (!busy) setClearDemo(false);
          }}
        >
          <div className="meal-form">
            <p>
              Exporta primero una copia desde Ajustes si quieres conservar estos
              datos.
            </p>
            <div className="form-footer">
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() => setClearDemo(false)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await repository.mutate((d) => {
                      d.householdMembers = [];
                      d.recipes = [];
                      d.ingredients = [];
                      d.recipeIngredients = [];
                      d.mealPlans = [];
                      d.mealEntries = [];
                      d.settings = d.settings.filter(
                        (s) => s.key !== "mealDemo",
                      );
                    });
                    setClearDemo(false);
                    setReport(null);
                    notify(
                      "El planificador está vacío. Ya puedes añadir tus datos.",
                    );
                  } catch (e) {
                    notify(errorMessage(e), true);
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Vaciar planificador
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
