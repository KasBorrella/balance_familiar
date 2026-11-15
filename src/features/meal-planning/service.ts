import { repository } from "@/db/repository";
import { metadata, type Row } from "@/domain/models";
import { entryReasons, generateMeals } from "@/domain/meals";

export async function saveRecipe(
  recipe: Row<"recipes">,
  ingredients: { ingredientId: string; quantityBase: number }[],
) {
  await repository.mutate((data) => {
    data.recipes = [...data.recipes.filter((r) => r.id !== recipe.id), recipe];
    data.recipeIngredients = [
      ...data.recipeIngredients.filter((i) => i.recipeId !== recipe.id),
      ...ingredients.map((i) => ({ ...metadata(), recipeId: recipe.id, ...i })),
    ];
  });
}
export async function saveMeal(entry: Row<"mealEntries">) {
  await repository.mutate((data) => {
    const plan = data.mealPlans.find((p) => p.id === entry.mealPlanId);
    if (!plan || !data.recipes.some((r) => r.id === entry.recipeId))
      throw new Error("El menú o la receta ya no existe.");
    const reasons = entryReasons(data, plan, entry);
    if (reasons.length) throw new Error(reasons.join(" "));
    data.mealEntries = [
      ...data.mealEntries.filter((e) => e.id !== entry.id),
      entry,
    ];
  });
}
export async function fillPlan(id: string) {
  let result = { added: 0, gaps: [] as string[] };
  await repository.mutate((data) => {
    const plan = data.mealPlans.find((p) => p.id === id);
    if (!plan) throw new Error("El menú ya no existe.");
    if (!data.householdMembers.some((m) => m.active))
      throw new Error("Añade al menos una persona activa en Familia.");
    const generated = generateMeals(data, plan);
    data.mealEntries.push(...generated.added);
    result = { added: generated.added.length, gaps: generated.gaps };
  });
  return result;
}
