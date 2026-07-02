// Поле добавления продукта в набор для подбора блюд (§6.1): автокомплит по
// базе (GET /api/ingredients?search=), но допускает и свободный ввод —
// свободно введённое имя сервер сам сопоставит через matching (§7.1).
// Используется и для подтверждения набора с фото, и для ручного ввода без
// фото — это одна и та же форма "набора продуктов" (§6.1 UX-нюанс).
import { useState, type KeyboardEvent } from "react";
import { useIngredientSearch } from "../api/ingredients";

export interface StagedIngredientChoice {
  label: string;
  ingredientId: string | null;
}

interface IngredientAutocompleteProps {
  onAdd: (choice: StagedIngredientChoice) => void;
  placeholder?: string;
}

export default function IngredientAutocomplete({ onAdd, placeholder }: IngredientAutocompleteProps) {
  const [query, setQuery] = useState("");
  // hasNutrition: true — этот компонент собирает набор продуктов для подбора
  // блюд (§6.1), в конвейер идут только ингредиенты с КБЖУ; "категорийные"
  // записи (напр. добавленные вручную в список покупок, §6.4) не должны даже
  // предлагаться здесь — по ним всё равно нельзя посчитать блюдо.
  const { data: suggestions } = useIngredientSearch(query, { hasNutrition: true });

  const addFreeText = () => {
    const trimmed = query.trim();
    if (!trimmed) return;
    onAdd({ label: trimmed, ingredientId: null });
    setQuery("");
  };

  const selectSuggestion = (ingredient: { id: string; name: string }) => {
    onAdd({ label: ingredient.name, ingredientId: ingredient.id });
    setQuery("");
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addFreeText();
    }
  };

  const showSuggestions = query.trim().length > 0 && (suggestions?.length ?? 0) > 0;

  return (
    <div className="relative">
      <div className="flex gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder ?? "Название продукта (напр. Куриное филе)"}
          className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={addFreeText}
          disabled={!query.trim()}
          className="shrink-0 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
        >
          Добавить
        </button>
      </div>
      {showSuggestions && (
        <ul className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {suggestions!.map((ing) => (
            <li key={ing.id}>
              <button
                type="button"
                onClick={() => selectSuggestion(ing)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-emerald-50"
              >
                {ing.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
