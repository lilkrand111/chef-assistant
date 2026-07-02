// Состояние экрана «Подбор блюд по продуктам» (§6.1) вынесено в контекст выше
// <Routes>, чтобы при переходе на детальную карточку блюда (кнопка "Подробнее")
// и обратно набор продуктов и уже подобранные/сгенерированные карточки не
// терялись при размонтировании PhotoPage — тот же приём, что и для
// MenuPlanProvider (state/menuPlanContext.tsx).
import { createContext, useContext, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from "react";
import type { FromIngredientsResponse } from "../api/types";

export interface StagedIngredientItem {
  key: string;
  label: string;
  ingredientId: string | null;
}

interface DishSelectionContextValue {
  staged: StagedIngredientItem[];
  // Функциональная форма (как у обычного useState), а не "setStaged(nextArray)":
  // распознавание фото добавляет несколько продуктов подряд синхронно
  // (forEach по ответу), и вызывающая сторона должна пересчитывать следующее
  // состояние от АКТУАЛЬНОГО prev на каждый вызов, а не от значения staged,
  // захваченного в замыкании на момент рендера — иначе из нескольких вызовов
  // подряд применяется только последний.
  setStaged: Dispatch<SetStateAction<StagedIngredientItem[]>>;
  result: FromIngredientsResponse | null;
  setResult: Dispatch<SetStateAction<FromIngredientsResponse | null>>;
}

const DishSelectionContext = createContext<DishSelectionContextValue | null>(null);

export function DishSelectionProvider({ children }: { children: ReactNode }) {
  const [staged, setStaged] = useState<StagedIngredientItem[]>([]);
  const [result, setResult] = useState<FromIngredientsResponse | null>(null);

  const value = useMemo(
    () => ({ staged, setStaged, result, setResult }),
    [staged, result]
  );

  return <DishSelectionContext.Provider value={value}>{children}</DishSelectionContext.Provider>;
}

export function useDishSelectionState(): DishSelectionContextValue {
  const ctx = useContext(DishSelectionContext);
  if (!ctx) throw new Error("useDishSelectionState должен использоваться внутри DishSelectionProvider");
  return ctx;
}
