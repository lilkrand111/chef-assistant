import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";

// Идентификация пользователя (§9 спецификации): в v1 аутентификации нет.
//
// Выбранный подход: фронтенд генерирует анонимный id (crypto.randomUUID),
// сохраняет его в localStorage и присылает в заголовке `x-user-id` на каждый
// запрос к API (см. frontend/src/api/client.ts). Если заголовок отсутствует
// (например, прямой curl-запрос без него) — используем единственного неявного
// пользователя из env `DEFAULT_USER_ID` (см. .env.example, §9). Оба варианта
// приводят к одному и тому же userId, которым фильтруются SavedRecipe и
// ShoppingItem.
declare module "fastify" {
  interface FastifyRequest {
    userId: string;
  }
}

const userIdPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("userId", "");
  app.addHook("onRequest", async (request) => {
    const header = request.headers["x-user-id"];
    const headerValue = Array.isArray(header) ? header[0] : header;
    request.userId = headerValue && headerValue.trim() !== "" ? headerValue.trim() : (process.env.DEFAULT_USER_ID ?? "default");
  });
};

export default fp(userIdPlugin);
