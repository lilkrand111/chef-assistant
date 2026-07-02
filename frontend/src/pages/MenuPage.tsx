// Раздел «Меню на день» (§6.2 спецификации): алгоритмический подбор из
// каталога через POST /api/menu/generate, без единого обращения к ИИ.
// Среди подходящих (±5% по ккал) вариантов сервер каждый раз выбирает
// случайный, поэтому повторное нажатие "Собрать меню" может вернуть другой план.
//
// Форма и собранный план хранятся в MenuPlanContext (не в локальном useState
// компонента): при переходе на детальную карточку блюда и обратно эта
// страница размонтируется и монтируется заново, а состояние в контексте
// переживает это и позволяет показать уже составленное меню, а не пустую форму.
import { useMemo, useState, type FormEvent } from "react";
import { useGenerateMenu, useReplaceMenuMeal } from "../api/menu";
import { ApiRequestError } from "../api/client";
import { useAddFromDish, useDeleteShoppingItem, usePatchShoppingItem, useShopping } from "../api/shopping";
import type { Goal, MealType } from "../api/types";
import DishCard from "../components/DishCard";
import { GOAL_LABELS, MEAL_TYPE_LABELS } from "../lib/labels";
import { useMenuPlanState } from "../state/menuPlanContext";
import { useShoppingContributions } from "../state/shoppingContributionsContext";

const GOALS: Goal[] = ["DIET", "MAINTENANCE", "MASS"];
const MENU_BACK_LINK = { path: "/menu", label: "Назад к меню" };
const round1 = (n: number) => Math.round(n * 10) / 10;

export default function MenuPage() {
  const { form, setForm, plan, setPlan } = useMenuPlanState();
  const [formError, setFormError] = useState<string | null>(null);
  const [addAllError, setAddAllError] = useState<string | null>(null);
  const [addAllPending, setAddAllPending] = useState(false);

  const generateMenu = useGenerateMenu();
  const replaceMenuMeal = useReplaceMenuMeal();
  const [replacingMealType, setReplacingMealType] = useState<MealType | null>(null);
  const [replaceError, setReplaceError] = useState<string | null>(null);
  const addFromDish = useAddFromDish();
  const deleteItem = useDeleteShoppingItem();
  const patchItem = usePatchShoppingItem();
  const { isAddedFromDish, markAddedFromDish, markRemovedFromDish } = useShoppingContributions();
  const { data: shopping } = useShopping({ enabled: Boolean(plan) });

  // ingredientId → уже есть в списке покупок (не важно, из какого блюда) —
  // нужно, чтобы при добавлении не создавать дубликат позиции для ингредиента,
  // который уже лежит в списке из другого источника.
  const shoppingIngredientIds = useMemo(() => {
    const ids = new Set<string>();
    for (const group of shopping?.groups ?? []) {
      for (const item of group.items) {
        if (item.ingredientId) ids.add(item.ingredientId);
      }
    }
    return ids;
  }, [shopping]);

  // ingredientId → { id, amount } первой позиции в списке покупок с этим
  // ингредиентом — нужно для точного вычитания количества, добавленного
  // именно этой кнопкой (см. DishCard.tsx — та же логика для одной карточки).
  const shoppingItemByIngredient = useMemo(() => {
    const map = new Map<string, { id: string; amount: number | null }>();
    for (const group of shopping?.groups ?? []) {
      for (const item of group.items) {
        if (item.ingredientId && !map.has(item.ingredientId)) {
          map.set(item.ingredientId, { id: item.id, amount: item.amount });
        }
      }
    }
    return map;
  }, [shopping]);

  const mealsWithMissingIngredients = useMemo(
    () =>
      (plan?.meals ?? []).map((meal) => ({
        meal,
        missingIngredientIds: meal.dish.ingredients
          .filter((ing) => !shoppingIngredientIds.has(ing.ingredientId))
          .map((ing) => ing.ingredientId),
      })),
    [plan, shoppingIngredientIds]
  );

  // Состояние кнопки хранится не глобальным наличием ингредиента в списке
  // (он мог туда попасть из другого блюда/вручную), а тем, что добавлено
  // именно этой кнопкой — через тот же контекст, что и кнопки на карточках
  // блюд (shoppingContributionsContext), чтобы повторное нажатие снимало
  // ровно добавленное отсюда количество, а не всё, что есть в списке.
  const allMenuIngredientsAdded =
    (plan?.meals.length ?? 0) > 0 &&
    (plan?.meals ?? []).every((meal) =>
      meal.dish.ingredients.every((ing) => isAddedFromDish(meal.dish.id, ing.ingredientId))
    );

  const handleAddAllMenuIngredients = async () => {
    setAddAllError(null);
    setAddAllPending(true);
    try {
      if (allMenuIngredientsAdded) {
        // Снимаем ровно то количество каждого ингредиента, которое было
        // добавлено этой кнопкой — учитываем накопление, если один и тот же
        // ингредиент встречается в нескольких приёмах пищи меню.
        const runningAmounts = new Map(shoppingItemByIngredient);
        for (const meal of plan?.meals ?? []) {
          for (const ing of meal.dish.ingredients) {
            if (!isAddedFromDish(meal.dish.id, ing.ingredientId)) continue;
            markRemovedFromDish(meal.dish.id, ing.ingredientId);
            const existing = runningAmounts.get(ing.ingredientId);
            if (!existing) continue;
            const deltaAmount = round1(ing.amount * meal.portionScale);
            const remaining = existing.amount != null ? round1(existing.amount - deltaAmount) : null;
            if (remaining == null || remaining <= 0.001) {
              await deleteItem.mutateAsync(existing.id);
              runningAmounts.delete(ing.ingredientId);
            } else {
              await patchItem.mutateAsync({ id: existing.id, amount: remaining });
              runningAmounts.set(ing.ingredientId, { ...existing, amount: remaining });
            }
          }
        }
      } else {
        // Помечаем "добавлено этой кнопкой" только те ингредиенты, которые
        // реально были добавлены сейчас (missingIngredientIds) — если
        // ингредиент уже лежал в списке из другого источника, эта кнопка его
        // не трогала и не должна претендовать на его удаление при отмене.
        for (const { meal, missingIngredientIds } of mealsWithMissingIngredients) {
          if (missingIngredientIds.length === 0) continue;
          await addFromDish.mutateAsync({
            dishId: meal.dish.id,
            ingredientIds: missingIngredientIds,
            scale: meal.portionScale,
          });
          missingIngredientIds.forEach((ingredientId) => markAddedFromDish(meal.dish.id, ingredientId));
        }
      }
    } catch (err) {
      setAddAllError(
        err instanceof ApiRequestError ? err.message : "Не удалось изменить ингредиенты меню в списке покупок"
      );
    } finally {
      setAddAllPending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const kcal = Number(form.targetKcal);
    if (!form.targetKcal || !Number.isFinite(kcal) || kcal <= 0) {
      setFormError("Укажите целевую калорийность больше 0");
      return;
    }

    generateMenu.mutate(
      {
        targetKcal: kcal,
        protein: form.protein ? Number(form.protein) : undefined,
        fat: form.fat ? Number(form.fat) : undefined,
        carb: form.carb ? Number(form.carb) : undefined,
        goal: form.goal,
      },
      {
        onSuccess: (data) => setPlan(data),
        onError: (err) => {
          setPlan(null);
          setFormError(
            err instanceof ApiRequestError ? err.message : "Не удалось собрать меню. Попробуйте ещё раз."
          );
        },
      }
    );
  };

  // Кнопка "Заменить" у блюда (§6.2): подбирает другое блюдо того же приёма
  // пищи, а остальные приёмы пищи бэкенд пересчитывает так, чтобы план
  // остался в пределах ±5% от цели (services/menu.ts → replaceMenuMeal),
  // поэтому цели меню остаются выполнены автоматически.
  const handleReplaceMeal = (mealType: MealType) => {
    if (!plan) return;
    setReplaceError(null);
    setReplacingMealType(mealType);
    const kcal = Number(form.targetKcal);

    replaceMenuMeal.mutate(
      {
        targetKcal: kcal,
        protein: form.protein ? Number(form.protein) : undefined,
        fat: form.fat ? Number(form.fat) : undefined,
        carb: form.carb ? Number(form.carb) : undefined,
        goal: form.goal,
        meals: plan.meals.map((m) => ({ mealType: m.mealType, dishId: m.dish.id, portionScale: m.portionScale })),
        mealType,
      },
      {
        onSuccess: (data) => {
          setPlan(data);
          setReplacingMealType(null);
        },
        onError: (err) => {
          setReplacingMealType(null);
          setReplaceError(
            err instanceof ApiRequestError ? err.message : "Не удалось заменить блюдо. Попробуйте ещё раз."
          );
        },
      }
    );
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Меню на день</h1>

      <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-sm text-gray-700">
            Целевые ккал *
            <input
              value={form.targetKcal}
              onChange={(e) => setForm({ ...form, targetKcal: e.target.value })}
              type="number"
              min="0"
              step="any"
              required
              className="mt-1 w-28 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col text-sm text-gray-700">
            Цель
            <select
              value={form.goal}
              onChange={(e) => setForm({ ...form, goal: e.target.value as Goal })}
              className="mt-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {GOALS.map((g) => (
                <option key={g} value={g}>
                  {GOAL_LABELS[g]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col text-sm text-gray-700">
            Белки, г (опц.)
            <input
              value={form.protein}
              onChange={(e) => setForm({ ...form, protein: e.target.value })}
              type="number"
              min="0"
              step="any"
              className="mt-1 w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col text-sm text-gray-700">
            Жиры, г (опц.)
            <input
              value={form.fat}
              onChange={(e) => setForm({ ...form, fat: e.target.value })}
              type="number"
              min="0"
              step="any"
              className="mt-1 w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="flex flex-col text-sm text-gray-700">
            Углеводы, г (опц.)
            <input
              value={form.carb}
              onChange={(e) => setForm({ ...form, carb: e.target.value })}
              type="number"
              min="0"
              step="any"
              className="mt-1 w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <button
          type="submit"
          disabled={generateMenu.isPending}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {generateMenu.isPending ? "Подбираем..." : "Собрать меню"}
        </button>

        {formError && <p className="text-sm text-red-600">{formError}</p>}
      </form>

      {plan && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              onClick={handleAddAllMenuIngredients}
              disabled={addAllPending}
              className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                allMenuIngredientsAdded
                  ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                  : "bg-emerald-600 text-white hover:bg-emerald-700"
              }`}
            >
              {addAllPending
                ? "Обновляем..."
                : allMenuIngredientsAdded
                  ? "✓ Все ингредиенты меню добавлены в список"
                  : "Добавить все ингредиенты меню в список покупок"}
            </button>
            {addAllError && <p className="text-sm text-red-600">{addAllError}</p>}
          </div>

          <div className="space-y-4">
            {plan.meals.map((meal) => (
              <div key={`${meal.mealType}-${meal.dish.id}`}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                    {MEAL_TYPE_LABELS[meal.mealType]}
                  </h2>
                  <button
                    onClick={() => handleReplaceMeal(meal.mealType)}
                    disabled={replacingMealType !== null}
                    className="shrink-0 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {replacingMealType === meal.mealType ? "Заменяем..." : "Заменить блюдо"}
                  </button>
                </div>
                <DishCard
                  dish={meal.dish}
                  variant="compact"
                  portionScale={meal.portionScale}
                  backLink={MENU_BACK_LINK}
                />
                {meal.portionScale !== 1 && (
                  <p className="mt-1 text-xs text-gray-500">
                    Базовый рецепт: {Math.round(meal.dish.kcal)} ккал на {meal.dish.servings} порц. — КБЖУ и
                    ингредиенты на детальной карточке пересчитаны с учётом коэффициента порции.
                  </p>
                )}
              </div>
            ))}
          </div>

          {replaceError && <p className="text-sm text-red-600">{replaceError}</p>}

          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <h2 className="mb-3 font-semibold text-gray-900">Итого за день</h2>
            <div className="grid grid-cols-4 gap-2 text-center text-sm">
              <div>
                <div className="font-semibold text-gray-900">{Math.round(plan.totals.kcal)}</div>
                <div className="text-gray-500">ккал</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900">{Math.round(plan.totals.protein)}</div>
                <div className="text-gray-500">Б</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900">{Math.round(plan.totals.fat)}</div>
                <div className="text-gray-500">Ж</div>
              </div>
              <div>
                <div className="font-semibold text-gray-900">{Math.round(plan.totals.carb)}</div>
                <div className="text-gray-500">У</div>
              </div>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Отклонение от цели: {plan.deviation.kcalAbsolute > 0 ? "+" : ""}
              {plan.deviation.kcalAbsolute} ккал ({plan.deviation.kcalPercent > 0 ? "+" : ""}
              {plan.deviation.kcalPercent}%)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
