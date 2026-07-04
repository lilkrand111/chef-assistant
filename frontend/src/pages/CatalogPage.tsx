import { useState } from "react";
import { useDishes } from "../api/dishes";
import type { MealType } from "../api/types";
import DishCard from "../components/DishCard";
import { MEAL_TYPE_LABELS } from "../lib/labels";

const MEAL_TYPES: MealType[] = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"];

export default function CatalogPage() {
  const [search, setSearch] = useState("");
  const [mealType, setMealType] = useState<MealType | "">("");
  const { data, isLoading, isError, error } = useDishes({
    search: search.trim() || undefined,
    mealType: mealType || undefined,
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Каталог блюд</h1>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по названию..."
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:min-w-[200px] sm:flex-1"
        />
        <select
          value={mealType}
          onChange={(e) => setMealType(e.target.value as MealType | "")}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm sm:w-auto"
        >
          <option value="">Все приёмы пищи</option>
          {MEAL_TYPES.map((mt) => (
            <option key={mt} value={mt}>
              {MEAL_TYPE_LABELS[mt]}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-gray-500">Загрузка...</p>}
      {isError && <p className="text-red-600">Ошибка загрузки: {(error as Error).message}</p>}
      {data && data.length === 0 && <p className="text-gray-500">Ничего не найдено.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {data?.map((dish) => (
          <DishCard key={dish.id} dish={dish} variant="compact" />
        ))}
      </div>
    </div>
  );
}
