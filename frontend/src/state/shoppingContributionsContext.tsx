// Какие ингредиенты были добавлены в список покупок с КАЖДОЙ карточки блюда
// (§6.5) — вынесено в контекст выше <Routes>, по той же причине, что и
// MenuPlanProvider: при переходе "Подробнее" → "Вернуться в каталог" →
// "Подробнее" компонент DishCard размонтируется и монтируется заново, и
// локальный useState потерял бы отметку "Добавлено" у уже добавленных
// ингредиентов. Состояние хранится отдельно для каждого блюда (dishId), чтобы
// тот же ингредиент, добавленный с другой карточки, не влиял на эту.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type ContributionsByDish = Record<string, Set<string>>; // dishId -> ingredientId[], добавленные с карточки этого блюда

interface ShoppingContributionsContextValue {
  isAddedFromDish: (dishId: string, ingredientId: string) => boolean;
  markAddedFromDish: (dishId: string, ingredientId: string) => void;
  markRemovedFromDish: (dishId: string, ingredientId: string) => void;
}

const ShoppingContributionsContext = createContext<ShoppingContributionsContextValue | null>(null);

export function ShoppingContributionsProvider({ children }: { children: ReactNode }) {
  const [byDish, setByDish] = useState<ContributionsByDish>({});

  const isAddedFromDish = useCallback(
    (dishId: string, ingredientId: string) => byDish[dishId]?.has(ingredientId) ?? false,
    [byDish],
  );

  const markAddedFromDish = useCallback((dishId: string, ingredientId: string) => {
    setByDish((prev) => {
      const next = new Set(prev[dishId] ?? []);
      next.add(ingredientId);
      return { ...prev, [dishId]: next };
    });
  }, []);

  const markRemovedFromDish = useCallback((dishId: string, ingredientId: string) => {
    setByDish((prev) => {
      if (!prev[dishId]?.has(ingredientId)) return prev;
      const next = new Set(prev[dishId]);
      next.delete(ingredientId);
      return { ...prev, [dishId]: next };
    });
  }, []);

  const value = useMemo(
    () => ({ isAddedFromDish, markAddedFromDish, markRemovedFromDish }),
    [isAddedFromDish, markAddedFromDish, markRemovedFromDish],
  );

  return <ShoppingContributionsContext.Provider value={value}>{children}</ShoppingContributionsContext.Provider>;
}

export function useShoppingContributions(): ShoppingContributionsContextValue {
  const ctx = useContext(ShoppingContributionsContext);
  if (!ctx) throw new Error("useShoppingContributions должен использоваться внутри ShoppingContributionsProvider");
  return ctx;
}
