# syntax=docker/dockerfile:1

# Способ доставки статики фронта в nginx (находка №1, Фаза D2): выбран
# ВАРИАНТ А — самодостаточная multi-stage сборка. Этот Dockerfile сам
# собирает фронт (контекст сборки — ../frontend, те же шаги, что и в
# frontend/Dockerfile) и в финальной стадии копирует результат в
# nginx:1.27-alpine. Дублирует несколько строк сборки фронта по сравнению с
# вариантом Б (переиспользование стадии "build" frontend/Dockerfile через
# именованный build-контекст) или вариантом В (общий volume + одноразовый
# сервис-копировщик), но не зависит от более новых/специфичных фич
# Compose/BuildKit и не создаёт скрытых межсервисных зависимостей сборки —
# самый предсказуемый вариант "из коробки" для любой установленной локально
# версии Docker/Compose.
#
# alpine здесь безопасен: предостережение №2 mobile-and-deployment-spec.md
# §0.1 (glibc, не musl) касается только бэкенда с onnxruntime-node/sharp;
# nginx нативных зависимостей такого рода не тянет.

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .

# Прод-сборка same-origin (см. frontend/Dockerfile, backend/.env.production.example):
# VITE_API_URL="" → все вызовы идут на относительный /api/..., который здесь
# же и проксирует nginx.
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx/nginx.conf

EXPOSE 80
