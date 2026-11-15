import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { useFinance } from "@/app/context";
import { repository } from "@/db/repository";
import { metadata, type Row } from "@/domain/models";
import { allergens, slots, slotLabels, type Slot } from "@/domain/meal-models";
import { addDays, portions, recipeReasons } from "@/domain/meals";
import { moneyInput, parseMoney } from "@/domain/money";
import { today } from "@/domain/calendar";
import { Modal } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/components/editor";
import { saveMeal, saveRecipe } from "./service";

export type MealEdit =
  | {
      [K in "member" | "ingredient" | "recipe" | "plan"]: {
        kind: K;
        id?: string;
      };
    }["member" | "ingredient" | "recipe" | "plan"]
  | {
      kind: "meal";
      plan: Row<"mealPlans">;
      date: string;
      slot: Slot;
      id?: string;
    };
const list = (text: string) => [
  ...new Set(
    text
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  ),
];
export function MealEditor({
  request,
  close,
}: {
  request: MealEdit;
  close: () => void;
}) {
  const { data, notify } = useFinance();
  const member = data.householdMembers.find((m) => m.id === request.id);
  const ingredient = data.ingredients.find((i) => i.id === request.id);
  const recipe = data.recipes.find((r) => r.id === request.id);
  const plan =
    request.kind === "meal"
      ? request.plan
      : data.mealPlans.find((p) => p.id === request.id);
  const meal = data.mealEntries.find((e) => e.id === request.id);
  const [checkedAllergens, setCheckedAllergens] = useState<string[]>(
    member?.restrictions ?? ingredient?.allergens ?? recipe?.allergens ?? [],
  );
  const [checkedSlots, setCheckedSlots] = useState<string[]>(
    member?.mealsAtHome ?? recipe?.mealType ?? ["lunch", "dinner"],
  );
  const [lines, setLines] = useState(() =>
    recipe
      ? data.recipeIngredients
          .filter((i) => i.recipeId === recipe.id)
          .map((i) => ({
            ingredientId: i.ingredientId,
            quantityBase: i.quantityBase,
          }))
      : [{ ingredientId: data.ingredients[0]?.id ?? "", quantityBase: 100 }],
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit } = useForm<Record<string, string>>({
    defaultValues: {
      alias: member?.alias ?? "",
      type: member?.type ?? "adult",
      portionsFactor: String(member?.portionsFactor ?? 1),
      active: member?.active === false ? "no" : "yes",
      preferences: member?.preferences.join(", ") ?? "",
      name: ingredient?.name ?? recipe?.name ?? "",
      baseUnit: ingredient?.baseUnit ?? "g",
      servings: String(
        recipe?.servings ??
          (request.kind === "meal"
            ? (meal?.servings ?? portions(data, request.slot))
            : 4),
      ),
      minutes: String(recipe?.minutes ?? 30),
      method: recipe?.method ?? "Cocina",
      instructions: recipe?.instructions ?? "",
      substitutions: recipe?.substitutions ?? "",
      foodGroups: recipe?.foodGroups.join(", ") ?? "",
      maxRepeat: String(recipe?.maxRepeat ?? 2),
      estimatedCost:
        recipe?.estimatedCostCents == null
          ? ""
          : moneyInput(recipe.estimatedCostCents),
      startDate: plan?.startDate ?? today(),
      duration: plan
        ? String(
            Math.round(
              (Date.parse(plan.endDate) - Date.parse(plan.startDate)) /
                86400000,
            ) + 1,
          )
        : "7",
      budget: plan?.budgetCents == null ? "" : moneyInput(plan.budgetCents),
      maxMinutes: String(plan?.maxMinutes ?? 45),
      status: plan?.status ?? "draft",
      recipeId: meal?.recipeId ?? "",
    },
  });
  const field = (
    name: string,
    label: string,
    type = "text",
    props: Record<string, string | number | boolean> = {},
  ) => (
    <label className="field" key={name}>
      <span>{label}</span>
      <input {...register(name)} type={type} required {...props} />
    </label>
  );
  const select = (name: string, label: string, options: [string, string][]) => (
    <label className="field">
      <span>{label}</span>
      <select {...register(name)} aria-label={label} required>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
    </label>
  );
  const area = (name: string, label: string, required = false) => (
    <label className="field">
      <span>{label}</span>
      <textarea
        {...register(name)}
        rows={4}
        required={required}
        maxLength={10000}
      />
    </label>
  );
  const checks = (
    label: string,
    options: readonly string[],
    selected: string[],
    change: (v: string[]) => void,
    labels?: Record<string, string>,
  ) => (
    <fieldset className="meal-checks">
      <legend>{label}</legend>
      {options.map((v) => (
        <label key={v}>
          <input
            type="checkbox"
            checked={selected.includes(v)}
            onChange={(e) =>
              change(
                e.target.checked
                  ? [...selected, v]
                  : selected.filter((s) => s !== v),
              )
            }
          />
          {labels?.[v] ?? v}
        </label>
      ))}
    </fieldset>
  );
  let fields: ReactNode;
  if (request.kind === "member")
    fields = (
      <>
        <div className="form-grid">
          {field("alias", "Nombre o apodo", "text", { maxLength: 120 })}
          {select("type", "Adulto o niño", [
            ["adult", "Adulto"],
            ["child", "Niño"],
          ])}
          {field("portionsFactor", "Raciones por comida", "number", {
            min: 0.25,
            max: 20,
            step: 0.25,
          })}
          {select("active", "Cuenta para los menús", [
            ["yes", "Sí"],
            ["no", "No, de momento"],
          ])}
        </div>
        <p className="field-hint">
          Una ración es la cantidad de referencia de tus recetas. Puedes usar
          medias raciones o cuartos; la app no las calcula por edad.
        </p>
        {checks(
          "Comidas que hace en casa",
          slots,
          checkedSlots,
          setCheckedSlots,
          slotLabels,
        )}
        {checks(
          "Alergias e intolerancias",
          allergens,
          checkedAllergens,
          setCheckedAllergens,
        )}
        {field(
          "preferences",
          "Ingredientes o platos que prefiere evitar (separados por comas)",
          "text",
          { required: false },
        )}
        <p className="field-hint">
          Por ejemplo: cebolla, brócoli. Se buscarán estas palabras en los
          nombres de los ingredientes y las recetas.
        </p>
      </>
    );
  else if (request.kind === "ingredient")
    fields = (
      <>
        {field("name", "Nombre del ingrediente", "text", { maxLength: 120 })}
        {select("baseUnit", "Unidad para las cantidades", [
          ["g", "Gramos"],
          ["ml", "Mililitros"],
          ["ud", "Unidades"],
        ])}
        {checks(
          "Alérgenos declarados",
          allergens,
          checkedAllergens,
          setCheckedAllergens,
        )}
      </>
    );
  else if (request.kind === "recipe")
    fields = (
      <>
        {field("name", "Nombre de la receta", "text", { maxLength: 120 })}
        <div className="form-grid">
          {field("servings", "Raciones de la receta", "number", {
            min: 1,
            max: 100,
          })}
          {field("minutes", "Tiempo (minutos)", "number", {
            min: 1,
            max: 1440,
          })}
          {field("method", "Preparación (horno, sartén…)", "text", {
            maxLength: 120,
          })}
          {field("maxRepeat", "Máximo en siete días", "number", {
            min: 1,
            max: 21,
          })}
          {field(
            "estimatedCost",
            "Coste estimado de toda la receta (€)",
            "text",
            { required: false, inputMode: "decimal" },
          )}
          {field(
            "foodGroups",
            "Grupos de alimentos (separados por comas)",
            "text",
            { required: false },
          )}
        </div>
        <p className="field-hint">
          Coste orientativo que introduces tú. No es un precio de supermercado
          ni el coste de los envases.
        </p>
        {checks("Sirve para", slots, checkedSlots, setCheckedSlots, slotLabels)}
        <fieldset className="meal-lines">
          <legend>Ingredientes y cantidades de toda la receta</legend>
          {!data.ingredients.length && (
            <p>Añade primero los ingredientes desde la pestaña Ingredientes.</p>
          )}
          {lines.map((line, index) => (
            <div key={index} className="meal-ingredient-line">
              <label className="field">
                <span>Ingrediente {index + 1}</span>
                <select
                  aria-label={`Ingrediente ${index + 1}`}
                  required
                  value={line.ingredientId}
                  onChange={(e) =>
                    setLines(
                      lines.map((l, n) =>
                        n === index
                          ? { ...l, ingredientId: e.target.value }
                          : l,
                      ),
                    )
                  }
                >
                  <option value="">Elegir ingrediente</option>
                  {data.ingredients.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} ({i.baseUnit})
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Cantidad</span>
                <input
                  aria-label={`Cantidad ${index + 1}`}
                  type="number"
                  min={1}
                  max={1000000}
                  required
                  value={line.quantityBase || ""}
                  onChange={(e) =>
                    setLines(
                      lines.map((l, n) =>
                        n === index
                          ? { ...l, quantityBase: Number(e.target.value) }
                          : l,
                      ),
                    )
                  }
                />
              </label>
              <Button
                type="button"
                variant="ghost"
                aria-label={`Quitar ingrediente ${index + 1}`}
                onClick={() => setLines(lines.filter((_, n) => n !== index))}
              >
                Quitar
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setLines([...lines, { ingredientId: "", quantityBase: 100 }])
            }
          >
            Añadir ingrediente
          </Button>
        </fieldset>
        {area("instructions", "Pasos", true)}
        {area("substitutions", "Sustituciones posibles")}
        <p className="field-hint">
          Las sustituciones son notas: no cambian cantidades ni alérgenos
          automáticamente.
        </p>
        {checks(
          "Otros alérgenos de la receta",
          allergens,
          checkedAllergens,
          setCheckedAllergens,
        )}
        <p className="field-hint">
          También se tendrán en cuenta los alérgenos de cada ingrediente.
        </p>
      </>
    );
  else if (request.kind === "plan")
    fields = (
      <>
        <div className="form-grid">
          {field("startDate", "Primer día", "date")}
          {select("duration", "Duración", [
            ["7", "Una semana (7 días)"],
            ["30", "30 días"],
            ["31", "31 días"],
          ])}
          {field("maxMinutes", "Tiempo máximo por receta (minutos)", "number", {
            min: 1,
            max: 1440,
          })}
          {field("budget", "Límite estimado para este menú (€)", "text", {
            required: false,
            inputMode: "decimal",
          })}
          {select("status", "Estado", [
            ["draft", "Borrador"],
            ["ready", "Preparado"],
          ])}
        </div>
        <p className="field-hint">
          El límite es opcional. Con límite, las propuestas necesitan recetas
          con coste estimado. No modifica tu presupuesto financiero ni registra
          gastos.
        </p>
      </>
    );
  else
    fields = (
      <>
        {select("recipeId", "Receta", [
          ["", "Elegir receta"],
          ...data.recipes.map(
            (r) =>
              [
                r.id,
                `${r.name}${recipeReasons(data, r, request.slot, request.plan.maxMinutes).length ? " · revisar restricciones" : ""}`,
              ] as [string, string],
          ),
        ])}
        {field("servings", "Raciones que vas a preparar", "number", {
          min: 0.25,
          max: 100,
          step: 0.25,
        })}
        <p className="field-hint">
          Hacen falta al menos {portions(data, request.slot)} raciones. Se
          comprobarán las alergias, preferencias, repeticiones y tiempo antes de
          guardar.
        </p>
      </>
    );
  const titles = {
    member: "Persona",
    ingredient: "Ingrediente",
    recipe: "Receta",
    plan: "Menú",
    meal: "Comida del menú",
  };
  return (
    <Modal
      title={`${request.id ? "Editar" : "Añadir"} ${titles[request.kind].toLowerCase()}`}
      description={
        request.kind === "meal"
          ? `${request.date} · ${slotLabels[request.slot]}`
          : "Los cambios se guardan en este dispositivo."
      }
      onClose={() => {
        if (!busy) close();
      }}
    >
      <form
        className="meal-form"
        onSubmit={handleSubmit(async (v) => {
          setBusy(true);
          setError("");
          try {
            const base = {
              ...(member ??
                ingredient ??
                recipe ??
                meal ??
                (request.kind === "plan" ? plan : undefined) ??
                metadata()),
              updatedAt: new Date().toISOString(),
            };
            const meta = {
              id: base.id,
              createdAt: base.createdAt,
              updatedAt: base.updatedAt,
            };
            if (request.kind === "member")
              await repository.save("householdMembers", {
                ...meta,
                alias: v.alias,
                type: v.type as "adult" | "child",
                portionsFactor: Number(v.portionsFactor),
                active: v.active === "yes",
                preferences: list(v.preferences),
                restrictions:
                  checkedAllergens as Row<"householdMembers">["restrictions"],
                mealsAtHome: checkedSlots as Slot[],
              });
            if (request.kind === "ingredient")
              await repository.save("ingredients", {
                ...meta,
                name: v.name,
                baseUnit: v.baseUnit as "g" | "ml" | "ud",
                allergens: checkedAllergens as Row<"ingredients">["allergens"],
              });
            if (request.kind === "recipe")
              await saveRecipe(
                {
                  ...meta,
                  name: v.name,
                  servings: Number(v.servings),
                  minutes: Number(v.minutes),
                  method: v.method,
                  maxRepeat: Number(v.maxRepeat),
                  estimatedCostCents: v.estimatedCost.trim()
                    ? parseMoney(v.estimatedCost)
                    : null,
                  foodGroups: list(v.foodGroups),
                  mealType: checkedSlots as Slot[],
                  instructions: v.instructions,
                  substitutions: v.substitutions,
                  allergens: checkedAllergens as Row<"recipes">["allergens"],
                  source: recipe?.source ?? "manual",
                },
                lines,
              );
            if (request.kind === "plan")
              await repository.save("mealPlans", {
                ...meta,
                startDate: v.startDate,
                endDate: addDays(v.startDate, Number(v.duration) - 1),
                maxMinutes: Number(v.maxMinutes),
                budgetCents: v.budget.trim() ? parseMoney(v.budget) : null,
                status: v.status as "draft" | "ready",
              });
            if (request.kind === "meal")
              await saveMeal({
                ...meta,
                mealPlanId: request.plan.id,
                date: request.date,
                slot: request.slot,
                recipeId: v.recipeId,
                servings: Number(v.servings),
              });
            notify("Cambios guardados.");
            close();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        })}
      >
        {fields}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={close}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
