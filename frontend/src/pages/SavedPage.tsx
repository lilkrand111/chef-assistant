import { useSaved } from "../api/saved";
import DishCard from "../components/DishCard";

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
          <DishCard key={dish.id} dish={dish} variant="compact" />
        ))}
      </div>
    </div>
  );
}
