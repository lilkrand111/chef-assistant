// Извлечение JSON-объекта из текстового ответа модели (§2, §10 спецификации):
// сторонний шлюз может не поддержать strict-режим structured outputs и вернуть
// JSON, завёрнутый в текст/markdown — этот код никогда не доверяет strict как
// гарантии и всегда парсит ответ сам. Общий для classify.ts, vision.ts, generate.ts.
import { AiServiceError } from "./errors";

export function extractJson(text: string, context: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    // не чистый JSON — ищем похожий на объект фрагмент ниже (напр. ```json {...} ```)
  }
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // падает в общую ошибку ниже
    }
  }
  throw new AiServiceError(`ИИ вернул ответ не в формате JSON (${context})`);
}
