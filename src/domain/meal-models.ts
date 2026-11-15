import { z } from "zod";

const meta = {
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};
const name = z.string().trim().min(1).max(120);
export const slots = ["breakfast", "lunch", "dinner"] as const;
export const slotLabels = {
  breakfast: "Desayuno",
  lunch: "Comida",
  dinner: "Cena",
};
export const allergens = [
  "gluten",
  "crustáceos",
  "huevo",
  "pescado",
  "cacahuetes",
  "soja",
  "leche",
  "frutos de cáscara",
  "apio",
  "mostaza",
  "sésamo",
  "sulfitos",
  "altramuces",
  "moluscos",
] as const;
const allergyList = z.array(z.enum(allergens));
export const memberSchema = z
  .object({
    ...meta,
    alias: name,
    type: z.enum(["adult", "child"]),
    portionsFactor: z.number().min(0.25).max(20).multipleOf(0.25),
    active: z.boolean(),
    restrictions: allergyList,
    preferences: z.array(name).max(30),
    mealsAtHome: z.array(z.enum(slots)).min(1),
  })
  .strict();
export const ingredientSchema = z
  .object({
    ...meta,
    name,
    baseUnit: z.enum(["g", "ml", "ud"]),
    allergens: allergyList,
  })
  .strict();
export const recipeSchema = z
  .object({
    ...meta,
    name,
    servings: z.number().int().min(1).max(100),
    mealType: z.array(z.enum(slots)).min(1),
    minutes: z.number().int().min(1).max(1440),
    method: name,
    instructions: z.string().trim().min(1).max(10000),
    substitutions: z.string().max(2000),
    foodGroups: z.array(name),
    allergens: allergyList,
    maxRepeat: z.number().int().min(1).max(21),
    estimatedCostCents: z.number().int().min(0).max(99999999).nullable(),
    source: z.enum(["manual", "demo"]),
  })
  .strict();
export const recipeIngredientSchema = z
  .object({
    ...meta,
    recipeId: z.string().uuid(),
    ingredientId: z.string().uuid(),
    quantityBase: z.number().int().min(1).max(1000000),
  })
  .strict();
export function mealPlanSchema(date: z.ZodString) {
  return z
    .object({
      ...meta,
      startDate: date,
      endDate: date,
      budgetCents: z.number().int().min(0).max(999999999).nullable(),
      maxMinutes: z.number().int().min(1).max(1440),
      status: z.enum(["draft", "ready"]),
    })
    .strict();
}
export function mealEntrySchema(date: z.ZodString) {
  return z
    .object({
      ...meta,
      mealPlanId: z.string().uuid(),
      date,
      slot: z.enum(slots),
      recipeId: z.string().uuid(),
      servings: z.number().min(0.25).max(100).multipleOf(0.25),
    })
    .strict();
}
export type Member = z.infer<typeof memberSchema>;
export type Ingredient = z.infer<typeof ingredientSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type Slot = (typeof slots)[number];
