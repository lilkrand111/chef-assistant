// Кеш ответов ИИ по (kind, keyHash) — §4.1 (AiCache), §10 «Кеширование ИИ».
// Общий для всех ИИ-путей: в Фазе 3 используется kind = "CATEGORY", Фаза 4
// переиспользует его же для "VISION"/"GENERATION" без изменений.
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../../db";

export type AiCacheKind = "CATEGORY" | "VISION" | "GENERATION";

// kind заведён в сам хеш, чтобы разные виды запросов с одинаковым
// нормализованным входом (в теории) не пересекались по keyHash — уникальный
// индекс в AiCache один на всю таблицу.
function hashKey(kind: AiCacheKind, normalizedInput: string): string {
  return crypto.createHash("sha256").update(`${kind}:${normalizedInput}`).digest("hex");
}

/**
 * Отдаёт результат из AiCache по (kind, normalizedInput); при промахе
 * считает через compute() и сохраняет. Ничего не знает про формат ответа —
 * валидация содержимого (Zod) остаётся на вызывающей стороне (classify.ts
 * и т.п.), см. §7.4: доверять кешу без валидации нельзя, схема могла
 * измениться.
 */
export async function withAiCache<T extends Prisma.InputJsonValue>(
  kind: AiCacheKind,
  normalizedInput: string,
  compute: () => Promise<T>
): Promise<{ value: T; fromCache: boolean }> {
  const keyHash = hashKey(kind, normalizedInput);

  const cached = await prisma.aiCache.findUnique({ where: { keyHash } });
  if (cached) {
    return { value: cached.responseJson as T, fromCache: true };
  }

  const computed = await compute();

  // upsert, а не create: конкурентный запрос с тем же входом мог успеть
  // записать кеш первым (гонка) — падать на unique-constraint не нужно,
  // просто перезаписываем тем же (валидным) значением.
  await prisma.aiCache.upsert({
    where: { keyHash },
    create: { kind, keyHash, responseJson: computed },
    update: { responseJson: computed },
  });

  return { value: computed, fromCache: false };
}
