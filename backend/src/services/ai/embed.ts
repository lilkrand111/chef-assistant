// Локальные эмбеддинги имён ингредиентов для семантического матчинга (§7.1 шаг 4,
// Фаза 5). Шлюз ИИ (AI_BASE_URL) эмбеддинги не отдаёт, поэтому вектора считаются
// ОФФЛАЙН, в этом же процессе Node — без сети на каждый запрос, без Python-сайдкара
// (§2 «одноязычность»). Модель работает через @huggingface/transformers (чистый
// ONNX-инференс в Node/WASM); наружу — только типизированные embed()/embedBatch(),
// matching.ts не знает, какая модель/библиотека внутри (§3, изоляция провайдера
// распространяется и на локальные модели).
import { z } from "zod";
import { AiServiceError } from "./errors";

export const EMBEDDING_DIM = 768;

// Дефолт — LaBSE (Language-agnostic BERT Sentence Embeddings, 109 языков,
// включая русский), 768-мерный выход. Выбрана вместо более лёгкой
// paraphrase-multilingual-MiniLM-L12-v2 по факту: на реальной проверке
// (см. §13 «Фаза 5») MiniLM давала грубые ложные срабатывания на редких
// заимствованных словах — напр. "цукини" оказывалось БЛИЖЕ по косинусу к
// "сахар" (0.96), чем к правильному "кабачок" (0.37) — то есть ошибалась не
// только порогом, а самим ранжированием ближайшего соседа. LaBSE на той же
// паре ранжирует верно (кабачок 0.69 > сахар 0.53). Имя модели и (опционально)
// путь к локально предзагруженным весам — только через env, не хардкодятся
// (§2 «сменяемость»): смена модели — правка .env, но ТОЛЬКО вместе с миграцией,
// пересоздающей vector(N) под новую размерность (см. комментарий в миграции
// pgvector_embeddings), иначе колонка/индекс рассинхронизируются с моделью.
const DEFAULT_MODEL = "Xenova/LaBSE";

const embedInputSchema = z.string().min(1);

const embedOutputSchema = z
  .array(z.number().finite())
  .length(EMBEDDING_DIM)
  .refine((vec) => vec.some((x) => x !== 0), { message: "нулевой вектор" });

export type EmbedInput = z.infer<typeof embedInputSchema>;
export type EmbedOutput = z.infer<typeof embedOutputSchema>;

// Тип из @huggingface/transformers достаточно узкий, чтобы не тянуть весь пакет
// типов в сигнатуру публичной функции — импортируется динамически (ESM-only
// пакет, бэкенд на CommonJS, см. getExtractor).
interface FeatureExtractionOutput {
  data: Float32Array | number[];
}
type FeatureExtractor = (
  text: string,
  options: { pooling: "mean"; normalize: boolean }
) => Promise<FeatureExtractionOutput>;

let extractorPromise: Promise<FeatureExtractor> | null = null;

// Ленивая инициализация: модель (десятки-сотни МБ) грузится в память один раз,
// при первом реальном вызове embed()/embedBatch(), а не при старте сервера —
// та же логика деградации, что и у getAiClient() (§10): сервер поднимается,
// даже если модель ещё не скачана/недоступна, ошибка возникает только при
// попытке ей воспользоваться.
function getExtractor(): Promise<FeatureExtractor> {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      // Динамический import: @huggingface/transformers — чистый ESM-пакет,
      // а бэкенд собран как CommonJS (package.json: "type": "commonjs").
      const { pipeline, env } = await import("@huggingface/transformers");

      const modelName = process.env.AI_EMBED_MODEL || DEFAULT_MODEL;
      const modelPath = process.env.AI_EMBED_MODEL_PATH;
      if (modelPath) {
        // Локально предзагруженные веса (без обращения к huggingface.co) —
        // на случай изолированного/офлайн-окружения.
        env.localModelPath = modelPath;
        env.allowRemoteModels = false;
      }

      try {
        const extractor = await pipeline("feature-extraction", modelName);
        return extractor as unknown as FeatureExtractor;
      } catch (err) {
        throw new AiServiceError(`Не удалось загрузить модель эмбеддингов "${modelName}"`, { cause: err });
      }
    })();
  }
  return extractorPromise;
}

function toValidatedVector(raw: FeatureExtractionOutput): EmbedOutput {
  const vec = Array.from(raw.data);
  const validated = embedOutputSchema.safeParse(vec);
  if (!validated.success) {
    throw new AiServiceError(
      `Модель эмбеддингов вернула некорректный вектор (ожидалась размерность ${EMBEDDING_DIM}): ${validated.error.issues[0]?.message ?? "?"}`
    );
  }
  return validated.data;
}

/** Эмбеддинг одной строки (уже нормализованной — см. matching.ts normalizeName). */
export async function embed(text: string): Promise<EmbedOutput> {
  return (await embedBatch([text]))[0];
}

/**
 * Батч-эмбеддинг (используется seed'ом для всех ингредиентов разом — дешевле,
 * чем грузить модель N раз). Бросает AiServiceError, если модель не смогла
 * загрузиться или вернула вектор неверной формы/нулевой/с NaN — это ошибка
 * данных, а не «тихий ноль», см. §7.4 сан-чек.
 */
export async function embedBatch(texts: string[]): Promise<EmbedOutput[]> {
  if (texts.length === 0) return [];
  for (const t of texts) {
    embedInputSchema.parse(t);
  }

  const extractor = await getExtractor();
  const results: EmbedOutput[] = [];
  for (const text of texts) {
    let raw: FeatureExtractionOutput;
    try {
      raw = await extractor(text, { pooling: "mean", normalize: true });
    } catch (err) {
      throw new AiServiceError(`Не удалось посчитать эмбеддинг для "${text}"`, { cause: err });
    }
    results.push(toValidatedVector(raw));
  }
  return results;
}

/** Форматирует вектор для raw-SQL cast к pgvector: '[0.1,0.2,...]'::vector */
export function toVectorLiteral(vec: number[]): string {
  return `[${vec.join(",")}]`;
}
