// Карточка блюда (§6.5 спецификации). "compact" — для списков (каталог,
// сохранённые), без пошагового рецепта, с переходом в детальную карточку.
// "full" — детальная страница: полный рецепт + добавление ингредиентов
// (по одному и всех сразу) в список покупок.
//
// portionScale — коэффициент масштабирования порции (из плана меню, §7.3).
// Если передан и отличается от 1, КБЖУ и количества ингредиентов показываются
// пересчитанными на этот коэффициент, а ссылка "Подробнее" в compact-варианте
// несёт его дальше в query-параметре, чтобы детальная карточка знала о нём.
//
// backLink — откуда открыта карточка (например, из плана меню), передаётся в
// history state ссылки "Подробнее"; детальная карточка (DishDetailPage)
// использует его, чтобы кнопка "назад" вела туда же, а не всегда в каталог.
import { Link } from "react-router-dom";
import { useSaveDish, useSaved, useUnsaveDish } from "../api/saved";
import {
  useAddFromDish,
  useAddShoppingItem,
  useDeleteShoppingItem,
  usePatchShoppingItem,
  useShopping,
} from "../api/shopping";
import type { DishCard as DishCardData, DishCardIngredient } from "../api/types";
import { DIFFICULTY_LABELS, MEAL_TYPE_LABELS } from "../lib/labels";
import { useShoppingContributions } from "../state/shoppingContributionsContext";

export interface DishDetailBackLink {
  path: string;
  label: string;
}

interface DishCardProps {
  dish: DishCardData;
  variant?: "compact" | "full";
  portionScale?: number;
  backLink?: DishDetailBackLink;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export default function DishCard({ dish, variant = "compact", portionScale = 1, backLink }: DishCardProps) {
  const { data: saved } = useSaved();
  const saveDish = useSaveDish();
  const unsaveDish = useUnsaveDish();
  const addFromDish = useAddFromDish();
  const addItem = useAddShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const patchItem = usePatchShoppingItem();
  // Список покупок нужен только на детальной странице (для состояния кнопок
  // "в список покупок"/"добавлено") — в компактных карточках не запрашиваем.
  const { data: shopping } = useShopping({ enabled: variant === "full" });

  // Какие ингредиенты добавлены в список покупок именно с ЭТОЙ карточки блюда
  // (хранится в контексте выше <Routes>, переживает переход туда-обратно в
  // каталог — см. shoppingContributionsContext.tsx). Отдельно от общего
  // наличия ингредиента в списке: тот же банан может уже лежать там из
  // другого блюда — кнопка здесь должна оставаться нейтральной, пока не
  // нажата на этой карточке, а повторное нажатие должно снять ровно то
  // количество, которое было добавлено отсюда, а не весь список.
  const { isAddedFromDish, markAddedFromDish, markRemovedFromDish } = useShoppingContributions();

  const isSaved = Boolean(saved?.some((d) => d.id === dish.id));

  const handleToggleSave = () => {
    if (isSaved) unsaveDish.mutate(dish.id);
    else saveDish.mutate(dish.id);
  };

  // ingredientId → id позиций в списке покупок, уже созданных из этого ингредиента.
  const shoppingItemIdsByIngredient = new Map<string, string[]>();
  for (const group of shopping?.groups ?? []) {
    for (const item of group.items) {
      if (!item.ingredientId) continue;
      const ids = shoppingItemIdsByIngredient.get(item.ingredientId) ?? [];
      ids.push(item.id);
      shoppingItemIdsByIngredient.set(item.ingredientId, ids);
    }
  }

  // Отмеченный ("куплено") пункт списка покупок считается закрытым — с точки
  // зрения карточки блюда он уже не "в списке покупок", кнопка должна
  // вернуться в исходное состояние (см. тест-кейс: отметить Молоко купленным
  // в /shopping → на карточке блюда снова должна быть кнопка "В список
  // покупок", а не "Добавлено").
  const isIngredientActiveInShopping = (ingredientId: string) =>
    (shopping?.groups ?? []).some((group) =>
      group.items.some((item) => item.ingredientId === ingredientId && !item.checked)
    );

  // ingredientId → { id, amount } первой позиции в списке покупок с этим
  // ингредиентом — нужно, чтобы при "отмене" с этой карточки снять ровно
  // добавленное отсюда количество, а не удалить всю позицию целиком (в ней
  // может быть ещё и вклад других блюд, содержащих тот же ингредиент).
  const shoppingItemByIngredient = new Map<string, { id: string; amount: number | null }>();
  for (const group of shopping?.groups ?? []) {
    for (const item of group.items) {
      if (item.ingredientId && !shoppingItemByIngredient.has(item.ingredientId)) {
        shoppingItemByIngredient.set(item.ingredientId, { id: item.id, amount: item.amount });
      }
    }
  }

  // Кнопка у отдельного ингредиента — переключатель, но локальный к этой
  // карточке (см. addedFromThisCard): первое нажатие добавляет порцию этого
  // блюда в список покупок (суммируясь с тем, что там уже есть от других
  // блюд), повторное — снимает ровно эту добавленную величину и возвращает
  // кнопку в исходное состояние. Дополнительно сверяемся с реальным списком
  // покупок (isIngredientActiveInShopping): если позицию уже отметили
  // купленной или удалили напрямую в /shopping, локальная память карточки
  // больше не считается актуальной.
  const isIngredientAddedHere = (ingredientId: string) =>
    isAddedFromDish(dish.id, ingredientId) && isIngredientActiveInShopping(ingredientId);

  const handleToggleIngredient = (ing: DishCardIngredient) => {
    const deltaAmount = round1(ing.amount * portionScale);

    if (isIngredientAddedHere(ing.ingredientId)) {
      markRemovedFromDish(dish.id, ing.ingredientId);
      const existing = shoppingItemByIngredient.get(ing.ingredientId);
      if (!existing) return;
      const remaining = existing.amount != null ? round1(existing.amount - deltaAmount) : null;
      if (remaining == null || remaining <= 0.001) {
        deleteItem.mutate(existing.id);
      } else {
        patchItem.mutate({ id: existing.id, amount: remaining });
      }
    } else {
      addItem.mutate({ ingredientId: ing.ingredientId, amount: deltaAmount, unit: ing.unit });
      markAddedFromDish(dish.id, ing.ingredientId);
    }
  };

  const allIngredientsAdded =
    dish.ingredients.length > 0 &&
    dish.ingredients.every((ing) => isIngredientActiveInShopping(ing.ingredientId));

  const handleToggleAll = () => {
    if (allIngredientsAdded) {
      dish.ingredients.forEach((ing) => {
        const ids = shoppingItemIdsByIngredient.get(ing.ingredientId) ?? [];
        ids.forEach((id) => deleteItem.mutate(id));
        markRemovedFromDish(dish.id, ing.ingredientId);
      });
    } else {
      const missingIds = dish.ingredients
        .filter((ing) => !isIngredientActiveInShopping(ing.ingredientId))
        .map((ing) => ing.ingredientId);
      addFromDish.mutate({ dishId: dish.id, ingredientIds: missingIds, scale: portionScale });
      missingIds.forEach((ingredientId) => markAddedFromDish(dish.id, ingredientId));
    }
  };

  const detailHref =
    portionScale !== 1 ? `/dishes/${dish.id}?portionScale=${portionScale}` : `/dishes/${dish.id}`;
  const detailLinkState = backLink ? { backLink } : undefined;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          {variant === "compact" ? (
            <Link
              to={detailHref}
              state={detailLinkState}
              className="text-lg font-semibold text-gray-900 hover:underline"
            >
              {dish.name}
            </Link>
          ) : (
            <h2 className="text-xl font-semibold text-gray-900">{dish.name}</h2>
          )}
          <p className="mt-1 text-sm text-gray-600">{dish.description}</p>
        </div>
        <button
          onClick={handleToggleSave}
          disabled={saveDish.isPending || unsaveDish.isPending}
          className={`inline-flex min-h-[44px] shrink-0 items-center rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${
            isSaved ? "bg-amber-100 text-amber-800 hover:bg-amber-200" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
          }`}
        >
          {isSaved ? "Убрать из сохранённых" : "Сохранить рецепт"}
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-600">
        <span>{MEAL_TYPE_LABELS[dish.mealType]}</span>
        <span>{dish.cookTimeMin} мин</span>
        <span>{dish.servings} порц.</span>
        <span>{DIFFICULTY_LABELS[dish.difficulty]}</span>
        {portionScale !== 1 && <span className="font-medium text-emerald-700">Порция ×{portionScale}</span>}
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-sm">
        <div>
          <div className="font-semibold text-gray-900">{Math.round(dish.kcal * portionScale)}</div>
          <div className="text-gray-500">ккал</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900">{Math.round(dish.protein * portionScale)}</div>
          <div className="text-gray-500">Б</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900">{Math.round(dish.fat * portionScale)}</div>
          <div className="text-gray-500">Ж</div>
        </div>
        <div>
          <div className="font-semibold text-gray-900">{Math.round(dish.carb * portionScale)}</div>
          <div className="text-gray-500">У</div>
        </div>
      </div>

      {variant === "compact" && (
        <Link
          to={detailHref}
          state={detailLinkState}
          className="mt-3 inline-block text-sm font-medium text-emerald-700 hover:underline"
        >
          Подробнее →
        </Link>
      )}

      {variant === "full" && (
        <>
          <div className="mt-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium text-gray-900">Ингредиенты</h3>
              <button
                onClick={handleToggleAll}
                disabled={addFromDish.isPending || deleteItem.isPending}
                className={`inline-flex min-h-[44px] items-center rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${
                  allIngredientsAdded
                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
                {allIngredientsAdded ? "✓ Добавлено" : "Добавить все в список покупок"}
              </button>
            </div>
            <ul className="divide-y divide-gray-100">
              {dish.ingredients.map((ing) => {
                const addedHere = isIngredientAddedHere(ing.ingredientId);
                return (
                  <li key={ing.ingredientId} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                    <span className="min-w-0 flex-1 break-words">
                      {ing.name} — {round1(ing.amount * portionScale)} {ing.unit}
                      {ing.note ? `, ${ing.note}` : ""}
                    </span>
                    <button
                      onClick={() => handleToggleIngredient(ing)}
                      disabled={addItem.isPending || deleteItem.isPending || patchItem.isPending}
                      className={`inline-flex min-h-[44px] shrink-0 items-center rounded-md border px-3 py-2 text-sm disabled:opacity-50 ${
                        addedHere
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-gray-300 text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {addedHere ? "✓ Добавлено" : "В список покупок"}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-4">
            <h3 className="mb-2 font-medium text-gray-900">Приготовление</h3>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
              {dish.steps.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </div>
        </>
      )}
    </div>
  );
}
