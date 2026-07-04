# syntax=docker/dockerfile:1

# node:20-bookworm-slim (glibc), НЕ alpine: onnxruntime-node и sharp — нативные
# бинарники, musl их ломает при первом инференсе эмбеддингов (предостережение
# №2, mobile-and-deployment-spec.md §0.1).

FROM node:20-bookworm-slim AS build
WORKDIR /app

# node:20-bookworm-slim не содержит пакет openssl "из коробки" — без него
# `prisma generate` не может определить версию libssl и по умолчанию
# выбирает бинарник движка под openssl-1.1.x, которого на Debian bookworm нет
# (там libssl3), что роняет клиент на старте в runtime-стадии. Ставим openssl
# в обеих стадиях (см. то же ниже в runtime).
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
# npm ci строго по package-lock.json — не npm install, чтобы не "заодно
# обновить" @fastify/multipart на v10 (несовместим с Fastify 4, предостережение №3).
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src

RUN npx prisma generate
# tsconfig.json include: ["src", "prisma"] — компилирует и src/, и
# prisma/seed.ts в dist/ (dist/prisma/seed.js), см. ниже почему это не
# используется напрямую.
RUN npm run build

FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# См. комментарий в build-стадии — тот же openssl нужен и в runtime, где
# реально исполняется скопированный движок Prisma (libquery_engine-*.so.node).
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*

# Решение по развилке "tsx для npm run seed" (см. промпт Фазы D0/D1):
# Вариант А выбран — node_modules копируется как есть из build-стадии (там
# уже стоят dev-зависимости, включая tsx), без отдельного `npm ci --omit=dev`
# для runtime. Причина: `npm run seed` (Фаза D3, `docker compose exec backend
# npm run seed`) вызывает `tsx prisma/seed.ts` — tsx это devDependency, и
# отдельный prod-only набор зависимостей его бы не содержал. Меняя
# package.json/prisma.seed на "node dist/prisma/seed.js" мы бы нарушили
# требование не трогать скрипты (§0.2). Цена — образ чуть тяжелее, чем при
# варианте Б (prod-only + точечная докопировка tsx), но без риска сюрпризов в D3.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
# `npm run seed` выполняет `tsx prisma/seed.ts` напрямую (не dist/), а
# seed.ts импортирует из "../src/*" (db, services/nutrition, matching,
# ai/embed) — без исходников tsx падает MODULE_NOT_FOUND в runtime-образе
# (найдено при первом реальном прогоне seed на сервере, Фаза D3).
COPY --from=build /app/src ./src
COPY package.json ./

# Кэш весов модели эмбеддингов (предостережение №2 §0.1). По умолчанию —
# онлайн-кэш HuggingFace: /models — точка монтирования volume "models" в
# docker-compose.prod.yml (Фаза D2). Переопределяется в env-файле контейнера
# через AI_EMBED_MODEL_PATH для офлайн-варианта (backend/.env.production.example).
ENV HF_HOME=/models/hf

EXPOSE 3000
# tsconfig.json: rootDir "." + include ["src","prisma"] → tsc сохраняет
# структуру директорий относительно rootDir, поэтому реальный скомпилированный
# вход — dist/src/server.js, а не dist/server.js (как в package.json →
# "start", который на практике не используется: локальная разработка всегда
# идёт через "dev" → tsx watch src/server.ts, поэтому это расхождение раньше
# не проявлялось). package.json не трогаем — путь ниже указывает на
# фактический результат сборки.
CMD ["node", "dist/src/server.js"]
