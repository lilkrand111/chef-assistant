import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import { useDish } from "../api/dishes";
import DishCard, { type DishDetailBackLink } from "../components/DishCard";

const DEFAULT_BACK_LINK: DishDetailBackLink = { path: "/dishes", label: "Назад в каталог" };

export default function DishDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error } = useDish(id);
  const [searchParams] = useSearchParams();
  const location = useLocation();

  // Коэффициент порции приходит из плана меню (§7.3) через query-параметр
  // ссылки "Подробнее" — детальная карточка должна показывать КБЖУ и
  // количества ингредиентов, пересчитанные на него, а не базовый рецепт.
  const rawScale = Number(searchParams.get("portionScale"));
  const portionScale = Number.isFinite(rawScale) && rawScale > 0 ? rawScale : 1;

  // Если сюда пришли по ссылке "Подробнее" из плана меню, DishCard передал
  // backLink через history state — кнопка "назад" должна вести туда же,
  // а не всегда в каталог.
  const backLink = (location.state as { backLink?: DishDetailBackLink } | null)?.backLink ?? DEFAULT_BACK_LINK;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <Link to={backLink.path} className="mb-4 inline-flex min-h-[44px] items-center text-sm text-emerald-700 hover:underline">
        ← {backLink.label}
      </Link>
      {isLoading && <p className="text-gray-500">Загрузка...</p>}
      {isError && <p className="text-red-600">Ошибка: {(error as Error).message}</p>}
      {data && <DishCard dish={data} variant="full" portionScale={portionScale} />}
    </div>
  );
}
