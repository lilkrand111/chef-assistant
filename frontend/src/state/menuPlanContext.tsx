// Состояние экрана «Меню на день» вынесено в контекст выше <Routes>, чтобы
// при переходе на детальную карточку блюда (кнопка "Подробнее") и обратно
// уже собранный план не терялся при размонтировании MenuPage. Дополнительно
// зеркалится в localStorage: план должен пережить и обновление страницы
// (F5), а не только смену маршрута в SPA — до следующей успешной сборки
// меню (или явной замены блюда) остаётся тем же самым.
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
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

const STORAGE_KEY = "chef-assistant:menuPlan";

interface PersistedMenuState {
  form: MenuFormState;
  plan: MenuPlan | null;
}

function loadPersisted(): PersistedMenuState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { form: DEFAULT_MENU_FORM, plan: null };
    const parsed = JSON.parse(raw) as Partial<PersistedMenuState>;
    return { form: parsed.form ?? DEFAULT_MENU_FORM, plan: parsed.plan ?? null };
  } catch {
    // повреждённый/устаревший формат в localStorage — не роняем экран, просто игнорируем
    return { form: DEFAULT_MENU_FORM, plan: null };
  }
}

export function MenuPlanProvider({ children }: { children: ReactNode }) {
  const [form, setForm] = useState<MenuFormState>(() => loadPersisted().form);
  const [plan, setPlan] = useState<MenuPlan | null>(() => loadPersisted().plan);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, plan }));
  }, [form, plan]);

  const value = useMemo(() => ({ form, setForm, plan, setPlan }), [form, plan]);

  return <MenuPlanContext.Provider value={value}>{children}</MenuPlanContext.Provider>;
}

export function useMenuPlanState(): MenuPlanContextValue {
  const ctx = useContext(MenuPlanContext);
  if (!ctx) throw new Error("useMenuPlanState должен использоваться внутри MenuPlanProvider");
  return ctx;
}
