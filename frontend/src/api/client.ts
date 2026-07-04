// Общий HTTP-клиент к бэкенду (§8 спецификации: единый формат ошибок
// { error: { code, message } }). Прокидывает анонимный userId (§9) в
// заголовке `x-user-id` на каждый запрос.
import { getUserId } from "../lib/userId";

const API_URL = import.meta.env.VITE_API_URL;

export class ApiRequestError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Content-Type: application/json — только когда реально есть JSON-тело.
  // FormData (загрузка фото, §6.1) не должна получить этот заголовок —
  // границу multipart браузер выставляет сам, вместе с boundary.
  // Для запросов без тела (api.delete) заголовок раньше выставлялся всегда —
  // на DELETE с пустым телом и Content-Type: application/json backend
  // (Fastify) может получить Content-Length от браузера и попытаться
  // распарсить пустое тело как JSON, упав с 400 FST_ERR_CTP_EMPTY_JSON_BODY
  // (backend/node_modules/fastify/lib/handleRequest.js, ветка DELETE/OPTIONS).
  const hasBody = options.body !== undefined;
  const isFormData = options.body instanceof FormData;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(hasBody && !isFormData ? { "Content-Type": "application/json" } : {}),
      "x-user-id": getUserId(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    let code = "UNKNOWN_ERROR";
    let message = `Ошибка запроса (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) {
        code = body.error.code ?? code;
        message = body.error.message ?? message;
      }
    } catch {
      // ответ без JSON-тела — оставляем сообщение по умолчанию
    }
    throw new ApiRequestError(res.status, code, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body !== undefined ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  postForm: <T>(path: string, formData: FormData) => request<T>(path, { method: "POST", body: formData }),
};
