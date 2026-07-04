import { useSaved } from "../api/saved";
import DishCard, { type DishDetailBackLink } from "../components/DishCard";

// Кнопка "Подробнее" на сохранённом рецепте должна возвращать сюда же (§13,
// кейс 25), а не всегда в каталог — тот же приём backLink, что и у меню/подбора.
const SAVED_BACK_LINK: DishDetailBackLink = { path: "/saved", label: "Назад к сохранённым" };

export default function SavedPage() {
  const { data, isLoading, isError, error } = useSaved();

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Сохранённые рецепты</h1>

      {isLoading && <p className="text-gray-500">Загрузка...</p>}
      {isError && <p className="text-red-600">Ошибка: {(error as Error).message}</p>}
      {data && data.length === 0 && <p className="text-gray-500">Пока нет сохранённых рецептов.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        {data?.map((dish) => (
          <DishCard key={dish.id} dish={dish} variant="compact" backLink={SAVED_BACK_LINK} />
        ))}
      </div>
    </div>
  );
}
