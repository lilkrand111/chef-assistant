import "dotenv/config";
import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { ZodError } from "zod";
import { prisma } from "./db";
import { ApiError } from "./lib/errors";
import userIdPlugin from "./plugins/userId";
import dishesRoutes from "./routes/dishes";
import ingredientsRoutes from "./routes/ingredients";
import menuRoutes from "./routes/menu";
import photoRoutes from "./routes/photo";
import savedRoutes from "./routes/saved";
import shoppingRoutes from "./routes/shopping";

const app = Fastify({ logger: true });

app.register(cors, { origin: true });
app.register(userIdPlugin);
// Загрузка фото (§6.1 «Вход A»): лимит размера файла — защита от случайных
// огромных загрузок, не связана с бизнес-логикой распознавания. 20 МБ —
// современные телефонные камеры (в т.ч. iPhone 48 Мп) легко дают фото по
// 10-20 МБ даже в JPEG; nginx.conf::client_max_body_size должен покрывать
// files (4) × это значение, иначе большие фото режутся раньше, чем дойдут
// сюда (см. production-runbook.md). files: 4 — та же граница, что и в
// routes/photo.ts, задана здесь ещё раз как жёсткий потолок на уровне
// парсера (защита от лишних вызовов ИИ, см. §10).
app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024, files: 4 } });

app.register(dishesRoutes);
app.register(ingredientsRoutes);
app.register(menuRoutes);
app.register(photoRoutes);
app.register(savedRoutes);
app.register(shoppingRoutes);

// Единый формат ошибок (§8 спецификации): { error: { code, message } }.
app.setErrorHandler((err, request, reply) => {
  if (err instanceof ApiError) {
    reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
    return;
  }
  if (err instanceof ZodError) {
    reply.status(400).send({
      error: {
        code: "VALIDATION_ERROR",
        message: err.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; "),
      },
    });
    return;
  }
  // Ошибки самого Fastify (битый JSON, неверный Content-Length и т.п.) уже
  // содержат корректный клиентский statusCode — сохраняем его вместо 500.
  if (typeof err.statusCode === "number" && err.statusCode < 500) {
    reply.status(err.statusCode).send({ error: { code: err.code ?? "BAD_REQUEST", message: err.message } });
    return;
  }
  request.log.error(err);
  reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Внутренняя ошибка сервера" } });
});

app.setNotFoundHandler((request, reply) => {
  reply.status(404).send({ error: { code: "NOT_FOUND", message: "Маршрут не найден" } });
});

// Health check только для проверки, что каркас поднимается и БД доступна.
app.get("/api/health", async () => {
  await prisma.$queryRaw`SELECT 1`;
  return { ok: true };
});

const port = Number(process.env.PORT ?? 3000);

app
  .listen({ port, host: "0.0.0.0" })
  .catch((err) => {
    app.log.error(err);
    process.exit(1);
  });
