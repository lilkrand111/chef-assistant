// Единственный модуль, знающий про ИИ-провайдера (§3, §10 спецификации).
// baseURL/apiKey/модели — только из env, никогда не хардкодятся. Больше
// никто в приложении не должен импортировать пакет "openai" напрямую.
import OpenAI from "openai";
import { AiServiceError } from "./errors";

export type AiTask = "CLASSIFY" | "GENERATION" | "VISION";

const clients: Partial<Record<AiTask, OpenAI>> = {};

// Обычно все задачи идут через один общий шлюз (AI_BASE_URL/AI_API_KEY).
// Но конкретную задачу можно перенаправить на отдельного провайдера через
// AI_<TASK>_BASE_URL/AI_<TASK>_API_KEY (например, VISION — на Google Gemini,
// пока GENERATION/CLASSIFY остаются на общем шлюзе).
function resolveConfig(task: AiTask): { baseURL: string; apiKey: string } {
  const baseURL = process.env[`AI_${task}_BASE_URL`] ?? process.env.AI_BASE_URL;
  const apiKey = process.env[`AI_${task}_API_KEY`] ?? process.env.AI_API_KEY;
  if (!baseURL || !apiKey) {
    throw new AiServiceError(
      `ИИ-шлюз для задачи ${task} не настроен: заполните AI_BASE_URL/AI_API_KEY ` +
        `(или AI_${task}_BASE_URL/AI_${task}_API_KEY) в backend/.env`
    );
  }
  return { baseURL, apiKey };
}

// Ленивая инициализация: если шлюз для задачи не задан, остальное приложение
// (каталог, меню, список покупок с ингредиентами из базы) должно продолжать
// работать — ошибка возникает только при попытке реально вызвать ИИ для этой
// задачи (§10 «Деградация»), а не при старте сервера.
export function getAiClient(task: AiTask): OpenAI {
  const cached = clients[task];
  if (cached) return cached;

  const { baseURL, apiKey } = resolveConfig(task);
  const client = new OpenAI({ baseURL, apiKey });
  clients[task] = client;
  return client;
}

/** Имя модели для задачи из AI_MODEL_CLASSIFY / AI_MODEL_GENERATION / AI_MODEL_VISION (§2, §10). */
export function getAiModel(task: AiTask): string {
  const envVar = `AI_MODEL_${task}` as const;
  const value = process.env[envVar];
  if (!value) {
    throw new AiServiceError(`Модель для задачи ${task} не настроена: заполните ${envVar} в backend/.env`);
  }
  return value;
}
