import { Link, useLocation } from "react-router-dom";
import type { DishDetailBackLink } from "./DishCard";

// Каталог добавлен как отдельный пункт (не входит в 4 основных раздела §2),
// чтобы было куда вести из «Сохранённых» и откуда проверять карточки блюд.
const LINKS = [
  { to: "/dishes", label: "Каталог" },
  { to: "/photo", label: "Фото" },
  { to: "/menu", label: "Меню" },
  { to: "/saved", label: "Сохранённые" },
  { to: "/shopping", label: "Список покупок" },
];

const DISH_DETAIL_PATH = /^\/dishes\/[^/]+$/;

export default function Nav() {
  const location = useLocation();

  // Детальная карточка блюда (/dishes/:id) сама по себе всегда "внутри"
  // каталога по URL, но пользователь мог попасть на неё из другого раздела
  // (напр. по кнопке "Подробнее" в плане меню) — тогда активной вкладкой
  // должна оставаться та, откуда пришли, а не "Каталог". Куда возвращаться,
  // DishCard уже передал в history state как backLink (см. DishDetailPage).
  const backLink = (location.state as { backLink?: DishDetailBackLink } | null)?.backLink;
  const activePathname =
    DISH_DETAIL_PATH.test(location.pathname) && backLink ? backLink.path : location.pathname;

  return (
    <header className="border-b border-gray-200 bg-white">
      <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-1 px-4 py-3">
        <span className="mr-4 font-bold text-emerald-700">ИИ-помощник шефа</span>
        {LINKS.map((link) => {
          const isActive =
            activePathname === link.to || (link.to === "/dishes" && activePathname.startsWith("/dishes/"));
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                isActive ? "bg-emerald-100 text-emerald-800" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
