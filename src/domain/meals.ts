import { metadata, type Data, type Row } from "./models";
import { slots, type Recipe, type Slot } from "./meal-models";

export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function planDates(plan: Row<"mealPlans">) {
  const dates: string[] = [];
  for (
    let date = plan.startDate;
    date <= plan.endDate && dates.length < 31;
    date = addDays(date, 1)
  )
    dates.push(date);
  return dates;
}
export function diners(data: Data, slot: Slot) {
  return data.householdMembers.filter(
    (m) => m.active && m.mealsAtHome.includes(slot),
  );
}
export function portions(data: Data, slot: Slot) {
  return diners(data, slot).reduce((sum, m) => sum + m.portionsFactor, 0);
}
const normalize = (s: string) =>
  s
    .trim()
    .toLocaleLowerCase("es-ES")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export function recipeReasons(
  data: Data,
  recipe: Recipe,
  slot: Slot,
  maxMinutes: number,
): string[] {
  const members = diners(data, slot);
  const ingredients = data.recipeIngredients
    .filter((i) => i.recipeId === recipe.id)
    .map((i) => data.ingredients.find((n) => n.id === i.ingredientId)!);
  const declared = new Set([
    ...recipe.allergens,
    ...ingredients.flatMap((i) => i.allergens),
  ]);
  const reasons: string[] = [];
  if (!members.length)
    reasons.push("No hay nadie que haga esta comida en casa.");
  if (!recipe.mealType.includes(slot))
    reasons.push("La receta no corresponde a esta comida.");
  if (recipe.minutes > maxMinutes)
    reasons.push(`Necesita ${recipe.minutes} minutos.`);
  for (const m of members) {
    const conflicts = m.restrictions.filter((a) => declared.has(a));
    if (conflicts.length)
      reasons.push(`${m.alias}: contiene ${conflicts.join(", ")}.`);
    const avoided = m.preferences.filter(
      (p) =>
        ingredients.some((i) => normalize(i.name).includes(normalize(p))) ||
        normalize(recipe.name).includes(normalize(p)),
    );
    if (avoided.length)
      reasons.push(`${m.alias} prefiere evitar: ${avoided.join(", ")}.`);
  }
  return reasons;
}
export function entryCost(data: Data, entry: Row<"mealEntries">) {
  const recipe = data.recipes.find((r) => r.id === entry.recipeId)!;
  return recipe.estimatedCostCents === null
    ? null
    : Math.ceil((recipe.estimatedCostCents * entry.servings) / recipe.servings);
}
export function planCost(data: Data, entries: Row<"mealEntries">[]) {
  const costs = entries.map((e) => entryCost(data, e));
  return {
    cents: costs.reduce<number>((sum, n) => sum + (n ?? 0), 0),
    missing: costs.filter((n) => n === null).length,
  };
}
export function repeated(
  data: Data,
  recipe: Recipe,
  date: string,
  entries: Row<"mealEntries">[],
) {
  // A cap applies to every rolling seven-day window, including manual insertions in the past.
  return Array.from({ length: 7 }, (_, i) => {
    const start = addDays(date, -i),
      end = addDays(start, 6);
    return entries.filter(
      (e) => e.recipeId === recipe.id && e.date >= start && e.date <= end,
    ).length;
  }).some((n) => n >= recipe.maxRepeat);
}
export function entryReasons(
  data: Data,
  plan: Row<"mealPlans">,
  entry: Row<"mealEntries">,
  entries = data.mealEntries.filter((e) => e.mealPlanId === plan.id),
) {
  const recipe = data.recipes.find((r) => r.id === entry.recipeId)!;
  const reasons = recipeReasons(data, recipe, entry.slot, plan.maxMinutes);
  if (entry.servings < portions(data, entry.slot))
    reasons.push("Faltan raciones para las personas que comen en casa.");
  if (
    repeated(
      data,
      recipe,
      entry.date,
      entries.filter((e) => e.id !== entry.id),
    )
  )
    reasons.push("Supera el máximo de repeticiones en siete días.");
  return reasons;
}
export function consolidateIngredients(
  data: Data,
  entries: Row<"mealEntries">[],
) {
  const totals = new Map<string, number>();
  for (const e of entries) {
    const recipe = data.recipes.find((r) => r.id === e.recipeId)!;
    for (const i of data.recipeIngredients.filter(
      (i) => i.recipeId === recipe.id,
    ))
      totals.set(
        i.ingredientId,
        (totals.get(i.ingredientId) ?? 0) +
          (i.quantityBase * e.servings) / recipe.servings,
      );
  }
  return [...totals]
    .map(([id, quantity]) => ({
      ingredient: data.ingredients.find((i) => i.id === id)!,
      quantity: Math.ceil(quantity),
    }))
    .sort((a, b) => a.ingredient.name.localeCompare(b.ingredient.name, "es"));
}
export function generateMeals(data: Data, plan: Row<"mealPlans">) {
  const entries = data.mealEntries.filter((e) => e.mealPlanId === plan.id);
  const added: Row<"mealEntries">[] = [],
    gaps: string[] = [];
  for (const date of planDates(plan))
    for (const slot of slots) {
      if (
        !diners(data, slot).length ||
        entries.some((e) => e.date === date && e.slot === slot)
      )
        continue;
      const eligible = data.recipes.filter(
        (r) =>
          !recipeReasons(data, r, slot, plan.maxMinutes).length &&
          !repeated(data, r, date, entries),
      );
      const candidates = eligible.map((r) => ({
        ...metadata(),
        mealPlanId: plan.id,
        date,
        slot,
        recipeId: r.id,
        servings: portions(data, slot),
      }));
      const cost = planCost(data, entries);
      const affordable = candidates.filter(
        (e) =>
          plan.budgetCents === null ||
          (cost.missing === 0 &&
            entryCost(data, e) !== null &&
            cost.cents + entryCost(data, e)! <= plan.budgetCents),
      );
      affordable.sort(
        (a, b) =>
          entries.filter((e) => e.recipeId === a.recipeId).length -
            entries.filter((e) => e.recipeId === b.recipeId).length ||
          (entryCost(data, a) ?? Number.MAX_SAFE_INTEGER) -
            (entryCost(data, b) ?? Number.MAX_SAFE_INTEGER) ||
          a.recipeId.localeCompare(b.recipeId),
      );
      if (affordable[0]) {
        entries.push(affordable[0]);
        added.push(affordable[0]);
      } else
        gaps.push(
          `${date} · ${slot}: ${eligible.length ? "falta un coste estimado o no queda presupuesto suficiente" : "no hay recetas que cumplan las preferencias, alergias, tiempo y repeticiones"}.`,
        );
    }
  return { added, gaps };
}
export function validateMeals(data: Data) {
  function assert(ok: unknown, message: string): asserts ok {
    if (!ok) throw new Error(message);
  }
  for (const slot of slots)
    assert(
      portions(data, slot) <= 100,
      "El planificador admite hasta 100 raciones por comida.",
    );
  for (const r of data.recipes)
    assert(
      data.recipeIngredients.some((i) => i.recipeId === r.id),
      `Añade ingredientes a «${r.name}».`,
    );
  const pairs = new Set<string>();
  for (const i of data.recipeIngredients) {
    assert(
      data.recipes.some((r) => r.id === i.recipeId) &&
        data.ingredients.some((n) => n.id === i.ingredientId),
      "La receta o el ingrediente no existe.",
    );
    const key = `${i.recipeId}/${i.ingredientId}`;
    assert(!pairs.has(key), "Hay ingredientes repetidos en una receta.");
    pairs.add(key);
  }
  for (const p of data.mealPlans)
    assert(
      p.endDate >= p.startDate && p.endDate <= addDays(p.startDate, 30),
      "El menú debe durar entre 1 y 31 días.",
    );
  const cells = new Set<string>();
  for (const e of data.mealEntries) {
    const p = data.mealPlans.find((p) => p.id === e.mealPlanId);
    assert(
      p && e.date >= p.startDate && e.date <= p.endDate,
      "La fecha de la comida no está dentro del menú.",
    );
    assert(
      data.recipes.some((r) => r.id === e.recipeId),
      "La receta del menú no existe.",
    );
    const key = `${e.mealPlanId}/${e.date}/${e.slot}`;
    assert(!cells.has(key), "Ya hay una receta en esa comida.");
    cells.add(key);
  }
}
