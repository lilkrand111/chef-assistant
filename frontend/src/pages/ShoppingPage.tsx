import { useState, type FormEvent } from "react";
import { ApiRequestError } from "../api/client";
import {
  useAddShoppingItem,
  useClearShopping,
  useDeleteShoppingItem,
  usePatchShoppingItem,
  useShopping,
} from "../api/shopping";
import { INGREDIENT_CATEGORY_LABELS } from "../lib/labels";

export default function ShoppingPage() {
  const { data, isLoading, isError, error } = useShopping();
  const addItem = useAddShoppingItem();
  const patchItem = usePatchShoppingItem();
  const deleteItem = useDeleteShoppingItem();
  const clearAll = useClearShopping();

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const trimmedName = name.trim();
    if (!trimmedName) return;

    addItem.mutate(
      {
        name: trimmedName,
        amount: amount ? Number(amount) : undefined,
        unit: unit.trim() || undefined,
      },
      {
        onSuccess: () => {
          setName("");
          setAmount("");
          setUnit("");
        },
        onError: (err) => {
          setFormError(err instanceof ApiRequestError ? err.message : "Не удалось добавить ингредиент");
        },
      }
    );
  };

  const totalItems = data?.groups.reduce((sum, g) => sum + g.items.length, 0) ?? 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Список покупок</h1>
        {totalItems > 0 && (
          <button
            onClick={() => clearAll.mutate()}
            disabled={clearAll.isPending}
            className="rounded-md border border-red-300 px-3 py-1 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            Очистить всё
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="mb-6 flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Название ингредиента"
          className="min-w-[160px] flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="Кол-во"
          type="number"
          min="0"
          step="any"
          className="w-24 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Ед."
          className="w-20 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={addItem.isPending || !name.trim()}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Добавить
        </button>
        {formError && <p className="w-full text-sm text-red-600">{formError}</p>}
      </form>

      {isLoading && <p className="text-gray-500">Загрузка...</p>}
      {isError && <p className="text-red-600">Ошибка: {(error as Error).message}</p>}
      {data && totalItems === 0 && <p className="text-gray-500">Список покупок пуст.</p>}

      <div className="space-y-6">
        {data?.groups.map((group) => (
          <div key={group.category}>
            <h2 className="mb-2 font-semibold text-gray-800">{INGREDIENT_CATEGORY_LABELS[group.category]}</h2>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
              {group.items.map((item) => (
                <li key={item.id} className="flex items-center gap-3 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => patchItem.mutate({ id: item.id, checked: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <span className={`flex-1 text-sm ${item.checked ? "text-gray-400 line-through" : "text-gray-800"}`}>
                    {item.name}
                    {item.amount != null ? ` — ${item.amount}${item.unit ? " " + item.unit : ""}` : ""}
                  </span>
                  <button
                    onClick={() => deleteItem.mutate(item.id)}
                    disabled={deleteItem.isPending}
                    className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50"
                  >
                    Удалить
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
