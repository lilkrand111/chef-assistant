import { Link, useLocation } from "react-router-dom";
import type { SVGProps } from "react";
import type { DishDetailBackLink } from "./DishCard";

type NavIcon = (props: SVGProps<SVGSVGElement>) => JSX.Element;

const iconProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

const CatalogIcon: NavIcon = (props) => (
  <svg {...iconProps} {...props}>
    <rect x="3" y="4" width="7" height="7" rx="1" />
    <rect x="14" y="4" width="7" height="7" rx="1" />
    <rect x="3" y="13" width="7" height="7" rx="1" />
    <rect x="14" y="13" width="7" height="7" rx="1" />
  </svg>
);

const PhotoIcon: NavIcon = (props) => (
  <svg {...iconProps} {...props}>
    <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
    <circle cx="12" cy="13" r="3.5" />
  </svg>
);

const MenuIcon: NavIcon = (props) => (
  <svg {...iconProps} {...props}>
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
);

const SavedIcon: NavIcon = (props) => (
  <svg {...iconProps} {...props}>
    <path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z" />
  </svg>
);

const ShoppingIcon: NavIcon = (props) => (
  <svg {...iconProps} {...props}>
    <path d="M3 4h2l2.4 12.2a2 2 0 0 0 2 1.8h7.6a2 2 0 0 0 2-1.6L21 8H6" />
    <circle cx="9" cy="20" r="1.4" />
    <circle cx="17" cy="20" r="1.4" />
  </svg>
);

// Каталог добавлен как отдельный пункт (не входит в 4 основных раздела §2),
// чтобы было куда вести из «Сохранённых» и откуда удобно проверять карточки блюд.
// shortLabel — короткая подпись под иконкой в мобильной нижней таб-панели
// (М1 mobile-and-deployment-spec.md); label — полная подпись десктопной навигации.
const LINKS = [
  { to: "/dishes", label: "Каталог", shortLabel: "Каталог", icon: CatalogIcon },
  // Раздел 1 (§6.1) — подбор по продуктам с двух входов (фото И ручной ввод),
  // поэтому вкладка называется "Подбор", а не "Фото" (совпадает с заголовком
  // экрана "Подбор блюд по продуктам" и обобщением раздела в §6.1/§13).
  { to: "/photo", label: "Подбор", shortLabel: "Подбор", icon: PhotoIcon },
  { to: "/menu", label: "Меню", shortLabel: "Меню", icon: MenuIcon },
  { to: "/saved", label: "Сохранённые", shortLabel: "Сохран.", icon: SavedIcon },
  { to: "/shopping", label: "Список покупок", shortLabel: "Покупки", icon: ShoppingIcon },
];

const DISH_DETAIL_PATH = /^\/dishes\/[^/]+$/;

export default function Nav() {
  const location = useLocation();

  // Детальная карточка блюда (/dishes/:id) сама по себе всегда "внутри"
  // каталога по URL, но пользователь мог попасть на неё из другого раздела
  // (напр. по кнопке "Подробнее" в плане меню) — тогда активной вкладкой
  // должна оставаться та, откуда пришли, а не "Каталог". Куда возвращаться,
  // DishCard уже передал в history state как backLink (см. DishDetailPage).
  // Общая для десктопной и мобильной навигации (М1) — обе используют один и
  // тот же activePathname/isActive, чтобы поведение подсветки не разошлось.
  const backLink = (location.state as { backLink?: DishDetailBackLink } | null)?.backLink;
  const activePathname =
    DISH_DETAIL_PATH.test(location.pathname) && backLink ? backLink.path : location.pathname;

  const isLinkActive = (to: string) =>
    activePathname === to || (to === "/dishes" && activePathname.startsWith("/dishes/"));

  return (
    <>
      {/* Десктоп (md: и выше) — прежняя горизонтальная панель без изменений (М1). */}
      <header className="hidden border-b border-gray-200 bg-white md:block">
        <nav className="mx-auto flex max-w-4xl flex-wrap items-center gap-1 px-4 py-3">
          <span className="mr-4 font-bold text-emerald-700">ИИ-помощник шефа</span>
          {LINKS.map((link) => {
            const isActive = isLinkActive(link.to);
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

      {/* Мобильный (базовые классы) — нижняя фиксированная таб-панель (М1):
          все 5 разделов равномерно распределены и доступны в один тап, каждый
          пункт — тач-таргет ≥44px (min-h-[52px] на всю ширину столбца). */}
      <nav
        aria-label="Основная навигация"
        className="fixed inset-x-0 bottom-0 z-10 flex border-t border-gray-200 bg-white md:hidden"
      >
        {LINKS.map((link) => {
          const isActive = isLinkActive(link.to);
          const Icon = link.icon;
          return (
            <Link
              key={link.to}
              to={link.to}
              className={`flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 py-1.5 text-[11px] font-medium ${
                isActive ? "text-emerald-700" : "text-gray-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              <span>{link.shortLabel}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
