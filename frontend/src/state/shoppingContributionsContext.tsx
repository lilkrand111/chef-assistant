// Какие ингредиенты были добавлены в список покупок с КАЖДОЙ карточки блюда
// (§6.5) — вынесено в контекст выше <Routes>, по той же причине, что и
// MenuPlanProvider: при переходе "Подробнее" → "Вернуться в каталог" →
// "Подробнее" компонент DishCard размонтируется и монтируется заново, и
// локальный useState потерял бы отметку "Добавлено" у уже добавленных
// ингредиентов. Состояние хранится отдельно для каждого блюда (dishId), чтобы
// тот же ингредиент, добавленный с другой карточки, не влиял на эту.
//
// Дополнительно зеркалится в localStorage (как menuPlanContext, §13 кейс 18):
// без этого F5 полностью пересоздаёт приложение и обнуляет byDish, из-за чего
// кнопка "В список покупок" сбрасывалась в исходное состояние, хотя сама
// позиция на сервере оставалась добавленной (DishCard сверяет оба условия —
// см. isIngredientAddedHere) — обновление страницы не должно "забывать",
// какая карточка что добавила.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type ContributionsByDish = Record<string, Set<string>>; // dishId -> ingredientId[], добавленные с карточки этого блюда
type PersistedContributions = Record<string, string[]>; // Set не сериализуется в JSON напрямую

interface ShoppingContributionsContextValue {
  isAddedFromDish: (dishId: string, ingredientId: string) => boolean;
  markAddedFromDish: (dishId: string, ingredientId: string) => void;
  markRemovedFromDish: (dishId: string, ingredientId: string) => void;
}

const ShoppingContributionsContext = createContext<ShoppingContributionsContextValue | null>(null);

const STORAGE_KEY = "chef-assistant:shoppingContributions";

function loadPersisted(): ContributionsByDish {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedContributions;
    const result: ContributionsByDish = {};
    for (const [dishId, ingredientIds] of Object.entries(parsed)) {
      result[dishId] = new Set(ingredientIds);
    }
    return result;
  } catch {
    // повреждённый/устаревший формат в localStorage — не роняем экран, просто игнорируем
    return {};
  }
}

function serialize(byDish: ContributionsByDish): PersistedContributions {
  const result: PersistedContributions = {};
  for (const [dishId, ingredientIds] of Object.entries(byDish)) {
    result[dishId] = [...ingredientIds];
  }
  return result;
}

export function ShoppingContributionsProvider({ children }: { children: ReactNode }) {
  const [byDish, setByDish] = useState<ContributionsByDish>(() => loadPersisted());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serialize(byDish)));
  }, [byDish]);

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
