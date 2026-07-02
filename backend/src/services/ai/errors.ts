// Единая ошибка ИИ-слоя (§3 спецификации: только services/ai/ знает про
// провайдера). Роуты ловят AiServiceError и превращают её в ApiError с
// понятным сообщением (§10 «Деградация») — сами про OpenAI SDK не знают.
export class AiServiceError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "AiServiceError";
  }
}
