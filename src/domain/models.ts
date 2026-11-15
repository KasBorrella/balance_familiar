import { z } from "zod";
import { shoppingSchemas, emptyShopping } from "./shopping-models";
import {
  memberSchema,
  ingredientSchema,
  recipeSchema,
  recipeIngredientSchema,
  mealPlanSchema,
  mealEntrySchema,
} from "./meal-models";
export const centsSchema = z.number().int().safe().min(0).max(999_999_999_999);
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const d = new Date(`${v}T12:00:00Z`);
    return !Number.isNaN(d.valueOf()) && d.toISOString().slice(0, 10) === v;
  }, "Fecha no válida");
export const periodSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const id = z.string().uuid();
const text = z.string().trim().min(1).max(120);
const meta = {
  id,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
};
export const frequencies = [
  "MONTHLY",
  "WEEKLY",
  "QUARTERLY",
  "YEARLY",
  "ONE_OFF",
  "CUSTOM_MONTHS",
] as const;
const recurrence = {
  name: text,
  amountCents: centsSchema,
  frequency: z.enum(frequencies),
  activeMonths: z.array(z.number().int().min(1).max(12)).max(12),
  dueDay: z.number().int().min(1).max(31),
  startDate: dateSchema,
  endDate: dateSchema.nullable(),
  archivedAt: z.string().datetime().nullable(),
};
export const categorySchema = z
  .object({
    ...meta,
    name: text,
    parentId: id.nullable(),
    type: z.enum(["expense", "income"]),
    sortOrder: z.number().int(),
    archivedAt: z.string().datetime().nullable(),
  })
  .strict();
export const expenseSchema = z
  .object({
    ...meta,
    ...recurrence,
    categoryId: id,
    kind: z.enum(["fixed", "variable"]),
    fundId: id.nullable(),
    notes: z.string().max(1000),
  })
  .strict();
export const incomeSchema = z
  .object({
    ...meta,
    ...recurrence,
    status: z.enum(["estimated", "confirmed"]),
  })
  .strict();
// Opening cash can be negative; money everywhere else is positive plus an explicit direction.
export const monthlyBudgetSchema = z
  .object({
    period: periodSchema,
    openingCashCents: z
      .number()
      .int()
      .safe()
      .min(-999_999_999_999)
      .max(999_999_999_999),
    savingsTargetCents: centsSchema,
    status: z.enum(["draft", "ready"]),
    updatedAt: z.string().datetime(),
  })
  .strict();
export const allocationSchema = z
  .object({
    ...meta,
    period: periodSchema,
    categoryId: id,
    amountCents: centsSchema,
    allocationType: z.literal("variable"),
  })
  .strict();
export const transactionSchema = z
  .object({
    ...meta,
    date: dateSchema,
    direction: z.enum(["income", "expense", "savings_in", "savings_out"]),
    amountCents: centsSchema.refine(
      (v) => v > 0,
      "Introduce un importe mayor que cero",
    ),
    categoryId: id.nullable(),
    expenseRuleId: id.nullable(),
    expenseKind: z.enum(["fixed", "variable"]).nullable().optional(),
    incomeRuleId: id.nullable(),
    occurrenceDate: dateSchema.nullable(),
    fundId: id.nullable(),
    goalId: id.nullable(),
    memo: text,
    source: z.enum(["manual", "demo"]),
  })
  .strict();
export const fundSchema = z
  .object({
    ...meta,
    name: text,
    targetCents: centsSchema,
    monthlyCents: centsSchema,
    dueDate: dateSchema,
    startDate: dateSchema,
    active: z.boolean(),
  })
  .strict();
export const entrySchema = z
  .object({
    ...meta,
    fundId: id,
    date: dateSchema,
    entryType: z.enum(["contribution", "withdrawal", "payment"]),
    amountCents: centsSchema.refine((v) => v > 0),
    transactionId: id.nullable(),
  })
  .strict();
export const goalSchema = z
  .object({
    ...meta,
    name: text,
    targetCents: centsSchema,
    deadline: dateSchema,
    active: z.boolean(),
  })
  .strict();
export const settingSchema = z
  .object({
    key: z.string(),
    value: z.union([z.string(), z.boolean(), z.number()]),
    updatedAt: z.string().datetime(),
  })
  .strict();
export const dataSchema = z
  .object({
    ...shoppingSchemas(dateSchema),
    settings: z.array(settingSchema),
    categories: z.array(categorySchema),
    incomeRules: z.array(incomeSchema),
    expenseRules: z.array(expenseSchema),
    monthlyBudgets: z.array(monthlyBudgetSchema),
    budgetAllocations: z.array(allocationSchema),
    transactions: z.array(transactionSchema),
    sinkingFunds: z.array(fundSchema),
    fundEntries: z.array(entrySchema),
    savingsGoals: z.array(goalSchema),
    householdMembers: z.array(memberSchema),
    ingredients: z.array(ingredientSchema),
    recipes: z.array(recipeSchema),
    recipeIngredients: z.array(recipeIngredientSchema),
    mealPlans: z.array(mealPlanSchema(dateSchema)),
    mealEntries: z.array(mealEntrySchema(dateSchema)),
  })
  .strict();
export type Category = z.infer<typeof categorySchema>;
export type ExpenseRule = z.infer<typeof expenseSchema>;
export type IncomeRule = z.infer<typeof incomeSchema>;
export type Recurrence = Pick<ExpenseRule, keyof typeof recurrence>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Fund = z.infer<typeof fundSchema>;
export type FundEntry = z.infer<typeof entrySchema>;
export type Goal = z.infer<typeof goalSchema>;
export type Data = z.infer<typeof dataSchema>;
export type TableName = keyof Data;
export type Row<K extends TableName> = Data[K][number];
export const tableNames = Object.keys(dataSchema.shape) as TableName[];
export function emptyData(): Data {
  return {
    ...emptyShopping(),
    settings: [],
    categories: [],
    incomeRules: [],
    expenseRules: [],
    monthlyBudgets: [],
    budgetAllocations: [],
    transactions: [],
    sinkingFunds: [],
    fundEntries: [],
    savingsGoals: [],
    householdMembers: [],
    ingredients: [],
    recipes: [],
    recipeIngredients: [],
    mealPlans: [],
    mealEntries: [],
  };
}
export function metadata() {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now };
}
