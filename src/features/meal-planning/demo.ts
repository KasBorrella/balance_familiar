import { metadata, type Data } from "@/domain/models";
import { today } from "@/domain/calendar";
import { addDays } from "@/domain/meals";
import type { Ingredient, Slot } from "@/domain/meal-models";
export function addMealDemo(data: Data) {
  if (
    [
      data.householdMembers,
      data.ingredients,
      data.recipes,
      data.mealPlans,
    ].some((rows) => rows.length)
  )
    throw new Error(
      "El ejemplo solo se puede cargar cuando el planificador está vacío.",
    );
  data.settings = data.settings.filter((s) => s.key !== "mealDemo");
  data.settings.push({
    key: "mealDemo",
    value: true,
    updatedAt: new Date().toISOString(),
  });
  for (const [alias, factor] of [
    ["Adulto de ejemplo 1", 1],
    ["Adulto de ejemplo 2", 1],
    ["Peque de ejemplo", 0.5],
  ] as const)
    data.householdMembers.push({
      ...metadata(),
      alias,
      type: factor === 0.5 ? "child" : "adult",
      portionsFactor: factor,
      active: true,
      restrictions: [],
      preferences: [],
      mealsAtHome: ["breakfast", "lunch", "dinner"],
    });
  const ingredient = (
    name: string,
    baseUnit: Ingredient["baseUnit"] = "g",
    allergens: Ingredient["allergens"] = [],
  ) => {
    const i = { ...metadata(), name, baseUnit, allergens };
    data.ingredients.push(i);
    return i.id;
  };
  const rice = ingredient("Arroz crudo"),
    chickpeas = ingredient("Garbanzos cocidos"),
    lentils = ingredient("Lentejas cocidas"),
    tomato = ingredient("Tomate"),
    courgette = ingredient("Calabacín"),
    potato = ingredient("Patata"),
    chicken = ingredient("Pollo"),
    eggs = ingredient("Huevo", "ud", ["huevo"]),
    pasta = ingredient("Pasta de trigo", "g", ["gluten"]),
    bread = ingredient("Pan de trigo", "g", ["gluten"]),
    oats = ingredient("Copos de avena", "g", ["gluten"]),
    milk = ingredient("Leche", "ml", ["leche"]),
    oil = ingredient("Aceite de oliva", "ml");
  const recipe = (
    name: string,
    mealType: Slot[],
    minutes: number,
    cost: number,
    ingredients: [string, number][],
    instructions: string,
    groups: string[],
  ) => {
    const r = {
      ...metadata(),
      name,
      mealType,
      minutes,
      estimatedCostCents: cost,
      servings: 4,
      maxRepeat: mealType.includes("breakfast") ? 4 : 2,
      method: "Cocina",
      instructions,
      substitutions: "",
      foodGroups: groups,
      allergens: [],
      source: "demo" as const,
    };
    data.recipes.push(r);
    data.recipeIngredients.push(
      ...ingredients.map(([ingredientId, quantityBase]) => ({
        ...metadata(),
        recipeId: r.id,
        ingredientId,
        quantityBase,
      })),
    );
  };
  recipe(
    "Tostadas con tomate",
    ["breakfast"],
    10,
    240,
    [
      [bread, 240],
      [tomato, 200],
      [oil, 20],
    ],
    "Tuesta el pan. Ralla el tomate y repártelo por encima con el aceite.",
    ["Cereales", "Hortalizas"],
  );
  recipe(
    "Gachas de avena",
    ["breakfast"],
    15,
    220,
    [
      [oats, 200],
      [milk, 800],
    ],
    "Calienta la leche, añade los copos y remueve a fuego suave hasta que espesen.",
    ["Cereales", "Lácteos"],
  );
  recipe(
    "Arroz con verduras",
    ["lunch", "dinner"],
    30,
    420,
    [
      [rice, 320],
      [courgette, 400],
      [tomato, 300],
      [oil, 30],
    ],
    "Trocea y sofríe las verduras. Añade el arroz y agua; cocina hasta que esté hecho.",
    ["Cereales", "Hortalizas"],
  );
  recipe(
    "Garbanzos con tomate",
    ["lunch", "dinner"],
    25,
    440,
    [
      [chickpeas, 800],
      [tomato, 400],
      [oil, 30],
    ],
    "Cocina el tomate con el aceite. Añade los garbanzos escurridos y calienta unos minutos.",
    ["Legumbres", "Hortalizas"],
  );
  recipe(
    "Lentejas con verduras",
    ["lunch", "dinner"],
    30,
    480,
    [
      [lentils, 800],
      [courgette, 400],
      [tomato, 200],
      [oil, 30],
    ],
    "Trocea y cocina las verduras. Añade las lentejas escurridas y un poco de agua; termina a fuego suave.",
    ["Legumbres", "Hortalizas"],
  );
  recipe(
    "Tortilla de patatas",
    ["lunch", "dinner"],
    45,
    500,
    [
      [eggs, 6],
      [potato, 700],
      [oil, 60],
    ],
    "Pela y corta las patatas. Cocínalas con el aceite, mézclalas con el huevo batido y cuaja la tortilla por ambas caras.",
    ["Huevos", "Tubérculos"],
  );
  recipe(
    "Pasta con calabacín",
    ["lunch", "dinner"],
    25,
    460,
    [
      [pasta, 320],
      [courgette, 500],
      [tomato, 300],
      [oil, 30],
    ],
    "Cuece la pasta. Saltea el calabacín y el tomate y mézclalos con la pasta escurrida.",
    ["Cereales", "Hortalizas"],
  );
  recipe(
    "Pollo con patatas",
    ["lunch", "dinner"],
    40,
    800,
    [
      [chicken, 600],
      [potato, 700],
      [oil, 30],
    ],
    "Trocea las patatas y el pollo. Cocina en una sartén amplia hasta que el pollo esté completamente hecho.",
    ["Carne", "Tubérculos"],
  );
  recipe(
    "Crema de calabacín con tostadas",
    ["lunch", "dinner"],
    30,
    400,
    [
      [courgette, 800],
      [potato, 300],
      [bread, 200],
      [oil, 20],
    ],
    "Cuece el calabacín y la patata con agua. Tritura con el aceite y sirve con pan tostado.",
    ["Hortalizas", "Cereales"],
  );
  data.mealPlans.push({
    ...metadata(),
    startDate: today(),
    endDate: addDays(today(), 6),
    budgetCents: null,
    maxMinutes: 45,
    status: "draft",
  });
}
