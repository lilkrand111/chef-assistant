// Единственный модуль, знающий про ИИ-провайдера (§3, §10 спецификации).
// baseURL/apiKey/модели — только из env, никогда не хардкодятся. Больше
// никто в приложении не должен импортировать пакет "openai" напрямую.
import OpenAI from "openai";
import { AiServiceError } from "./errors";

let client: OpenAI | null = null;

// Ленивая инициализация: если AI_BASE_URL/AI_API_KEY не заданы, остальное
// приложение (каталог, меню, список покупок с ингредиентами из базы) должно
// продолжать работать — ошибка возникает только при попытке реально вызвать
// ИИ (§10 «Деградация»), а не при старте сервера.
export function getAiClient(): OpenAI {
  if (client) return client;

  const baseURL = process.env.AI_BASE_URL;
  const apiKey = process.env.AI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new AiServiceError(
      "ИИ-шлюз не настроен: заполните AI_BASE_URL и AI_API_KEY в backend/.env"
    );
  }

  client = new OpenAI({ baseURL, apiKey });
  return client;
}

export type AiTask = "CLASSIFY" | "GENERATION" | "VISION";

/** Имя модели для задачи из AI_MODEL_CLASSIFY / AI_MODEL_GENERATION / AI_MODEL_VISION (§2, §10). */
export function getAiModel(task: AiTask): string {
  const envVar = `AI_MODEL_${task}` as const;
  const value = process.env[envVar];
  if (!value) {
    throw new AiServiceError(`Модель для задачи ${task} не настроена: заполните ${envVar} в backend/.env`);
  }
  return value;
}
