// Раздел 1 — подбор блюд по ингредиентам (§6.1 спецификации). Два входа
// (фото и ручной ввод без фото) сходятся в один "набор продуктов" ниже и
// один и тот же вызов POST /api/dishes/from-ingredients (§8).
import { useRef, useState, type ChangeEvent } from "react";
import { ApiRequestError } from "../api/client";
import { useDishesFromIngredients } from "../api/dishes";
import { useDetectPhoto } from "../api/photo";
import DishCard, { type DishDetailBackLink } from "../components/DishCard";
import IngredientAutocomplete, { type StagedIngredientChoice } from "../components/IngredientAutocomplete";
import { compressImage } from "../lib/compressImage";
import { useDishSelectionState } from "../state/dishSelectionContext";

const RESULT_BACK_LINK: DishDetailBackLink = { path: "/photo", label: "Назад к подбору" };
const ACCEPTED_TYPES = "image/jpeg,image/png,image/webp,image/gif";
// Одно обращение к ИИ обрабатывает сразу весь набор фото (см. backend
// services/ai/vision.ts) — лимит нужен, чтобы не выбрать больше, чем
// принимает бэкенд, а не только для экономии запросов.
const MAX_PHOTOS = 4;
const normalize = (s: string) => s.trim().toLowerCase();

export default function PhotoPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [isCompressing, setIsCompressing] = useState(false);
  // Набор продуктов и результат подбора — в контексте выше <Routes> (а не в
  // локальном useState), иначе переход "Подробнее" → "Назад к подбору"
  // размонтировал бы PhotoPage и стирал бы уже сформированные карточки.
  const { staged, setStaged, result, setResult } = useDishSelectionState();
  const keyCounter = useRef(0);

  const detectPhoto = useDetectPhoto();
  const fromIngredients = useDishesFromIngredients();

  const addStagedItem = (choice: StagedIngredientChoice) => {
    // Функциональная форма setStaged: распознавание фото вызывает
    // addStagedItem несколько раз подряд синхронно (forEach по продуктам) —
    // каждый вызов должен видеть результат предыдущего, а не значение staged
    // из замыкания на момент рендера (иначе из нескольких продуктов
    // добавлялся бы только последний).
    setStaged((prev) => {
      const alreadyStaged = prev.some((item) =>
        choice.ingredientId
          ? item.ingredientId === choice.ingredientId
          : !item.ingredientId && normalize(item.label) === normalize(choice.label)
      );
      if (alreadyStaged) return prev;
      keyCounter.current += 1;
      return [...prev, { key: `item-${keyCounter.current}`, label: choice.label, ingredientId: choice.ingredientId }];
    });
  };

  const removeStagedItem = (key: string) => {
    setStaged((prev) => prev.filter((item) => item.key !== key));
  };

  const clearStaged = () => setStaged([]);

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    previewUrls.forEach((url) => URL.revokeObjectURL(url));
    if (selected.length > MAX_PHOTOS) {
      setSelectionError(`Можно выбрать не больше ${MAX_PHOTOS} фото за один раз — взяты первые ${MAX_PHOTOS}.`);
    } else {
      setSelectionError(null);
    }
    const limited = selected.slice(0, MAX_PHOTOS);
    setFiles([]);
    setPreviewUrls([]);
    // Сжимаем на телефоне до отправки (§6.1) — иначе по мобильной сети уходит
    // оригинал (часто 10-20+ МБ с телефона), а не то, что реально распознаётся.
    setIsCompressing(true);
    const compressed = await Promise.all(limited.map((f) => compressImage(f)));
    setIsCompressing(false);
    setFiles(compressed);
    setPreviewUrls(compressed.map((f) => URL.createObjectURL(f)));
  };

  const handleDetect = () => {
    if (files.length === 0) return;
    // Один вызов на весь набор фото (до 4 за раз) — не по одному запросу на
    // фото, чтобы не расходовать лишние обращения к ИИ.
    detectPhoto.mutate(files, {
      onSuccess: (data) => {
        // Промежуточное подтверждение (§6.1): распознанные продукты попадают
        // в общий набор ниже — как совпавшие с базой, так и нет, чтобы
        // пользователь мог убрать лишнее/поправить до подбора блюд.
        data.products.forEach((p) => addStagedItem({ label: p.name, ingredientId: p.ingredientId ?? null }));
      },
    });
  };

  const handleSubmit = () => {
    if (staged.length === 0) return;
    const ingredientIds = staged.filter((i) => i.ingredientId).map((i) => i.ingredientId!);
    const names = staged.filter((i) => !i.ingredientId).map((i) => i.label);
    // Результат сохраняем в контекст (не только в fromIngredients.data,
    // которое живёт лишь пока смонтирован этот компонент), чтобы карточки
    // не терялись при переходе "Подробнее" → "Назад к подбору".
    fromIngredients.mutate({ ingredientIds, names }, { onSuccess: (data) => setResult(data) });
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Подбор блюд по продуктам</h1>
      <p className="mb-6 text-sm text-gray-500">
        Загрузите фото продуктов или добавьте их вручную ниже — подберём подходящие блюда из каталога
        или составим новое из того, что есть под рукой.
      </p>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <h2 className="mb-3 font-medium text-gray-900">По фото</h2>
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept={ACCEPTED_TYPES}
            multiple
            onChange={handleFileChange}
            className="max-w-full text-sm"
          />
          <button
            type="button"
            onClick={handleDetect}
            disabled={files.length === 0 || isCompressing || detectPhoto.isPending}
            className="inline-flex min-h-[44px] items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {isCompressing
              ? "Обрабатываем фото..."
              : detectPhoto.isPending
                ? "Распознаём..."
                : `Распознать продукты${files.length > 1 ? ` (${files.length} фото)` : ""}`}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-400">До {MAX_PHOTOS} фото за 1 раз.</p>
        {selectionError && <p className="mt-2 text-sm text-amber-700">{selectionError}</p>}
        {previewUrls.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {previewUrls.map((url, i) => (
              <img
                key={url}
                src={url}
                alt={`Предпросмотр загруженного фото ${i + 1}`}
                className="max-h-40 rounded-md border border-gray-200 object-contain"
              />
            ))}
          </div>
        )}
        {detectPhoto.isError && (
          <p className="mt-2 text-sm text-red-600">
            {detectPhoto.error instanceof ApiRequestError
              ? detectPhoto.error.message
              : "Не удалось распознать фото. Попробуйте ещё раз."}
          </p>
        )}
        {detectPhoto.data && detectPhoto.data.unmatched.length > 0 && (
          <p className="mt-2 text-sm text-amber-700">
            Не найдено в базе: {detectPhoto.data.unmatched.join(", ")} — добавлено в набор ниже как есть,
            при желании поправьте или уберите.
          </p>
        )}
      </section>

      <section className="mb-6 rounded-lg border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-medium text-gray-900">Набор продуктов</h2>
          {staged.length > 0 && (
            <button
              type="button"
              onClick={clearStaged}
              className="inline-flex min-h-[44px] items-center rounded-md border border-red-300 px-3 text-sm text-red-700 hover:bg-red-50"
            >
              Очистить всё
            </button>
          )}
        </div>
        <p className="mb-3 text-sm text-gray-500">
          Уберите лишнее, добавьте своё — для ручного ввода без фото просто добавляйте продукты здесь,
          это и есть весь набор для подбора.
        </p>
        <IngredientAutocomplete onAdd={addStagedItem} />
        {staged.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {staged.map((item) => (
              <li
                key={item.key}
                className="flex items-center gap-1 rounded-full border border-gray-300 bg-gray-50 py-1 pl-3 pr-1 text-sm text-gray-800"
              >
                <span>{item.label}</span>
                {!item.ingredientId && (
                  <span
                    className="text-xs text-amber-600"
                    title="Не найдено в базе — будет передано как свободный текст"
                  >
                    ?
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => removeStagedItem(item.key)}
                  className="ml-1 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700"
                  aria-label={`Убрать ${item.label}`}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-gray-400">
            Список пуст — добавьте продукты вручную или распознайте с фото выше.
          </p>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={staged.length === 0 || fromIngredients.isPending}
          className="mt-4 inline-flex min-h-[44px] items-center rounded-md bg-emerald-600 px-4 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {fromIngredients.isPending ? "Подбираем блюда..." : "Подобрать блюда"}
        </button>
        {fromIngredients.isError && (
          <p className="mt-2 text-sm text-red-600">
            {fromIngredients.error instanceof ApiRequestError
              ? fromIngredients.error.message
              : "Не удалось подобрать блюда. Попробуйте ещё раз."}
          </p>
        )}
      </section>

      {result && (
        <section className="space-y-4">
          <h2 className="font-medium text-gray-900">Результат</h2>
          {result.unmatched.length > 0 && (
            <p className="text-sm text-amber-700">Не учтено при подборе: {result.unmatched.join(", ")}</p>
          )}
          {result.dishes.length === 0 ? (
            <p className="text-sm text-gray-500">Не удалось подобрать ни одного блюда для этого набора продуктов.</p>
          ) : (
            <div className="space-y-3">
              {result.dishes.map((dish) => (
                <div key={dish.id}>
                  {dish.source === "AI" && (
                    <p className="mb-1 text-xs font-medium text-emerald-700">Сгенерировано ИИ</p>
                  )}
                  <DishCard dish={dish} variant="compact" backLink={RESULT_BACK_LINK} />
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
