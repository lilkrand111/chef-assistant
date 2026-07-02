// Состояние экрана «Меню на день» вынесено в контекст выше <Routes>, чтобы
// при переходе на детальную карточку блюда (кнопка "Подробнее") и обратно
// уже собранный план не терялся при размонтировании MenuPage.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { Goal, MenuPlan } from "../api/types";

export interface MenuFormState {
  targetKcal: string;
  protein: string;
  fat: string;
  carb: string;
  goal: Goal;
}

export const DEFAULT_MENU_FORM: MenuFormState = {
  targetKcal: "2000",
  protein: "",
  fat: "",
  carb: "",
  goal: "MAINTENANCE",
};

interface MenuPlanContextValue {
  form: MenuFormState;
  setForm: (form: MenuFormState) => void;
  plan: MenuPlan | null;
  setPlan: (plan: MenuPlan | null) => void;
}

const MenuPlanContext = createContext<MenuPlanContextValue | null>(null);

export function MenuPlanProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<MenuFormState>(DEFAULT_MENU_FORM);
  const [plan, setPlan] = useState<MenuPlan | null>(null);

  const value = useMemo(() => ({ form, setForm, plan, setPlan }), [form, plan]);

  return <MenuPlanContext.Provider value={value}>{children}</MenuPlanContext.Provider>;
}

export function useMenuPlanState(): MenuPlanContextValue {
  const ctx = useContext(MenuPlanContext);
  if (!ctx) throw new Error("useMenuPlanState должен использоваться внутри MenuPlanProvider");
  return ctx;
}
