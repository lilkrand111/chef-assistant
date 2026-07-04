# syntax=docker/dockerfile:1

FROM node:20-bookworm-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite инлайнит import.meta.env.VITE_* на этапе сборки (не рантайма) —
# поэтому VITE_API_URL передаётся через ARG/ENV перед `npm run build`, а не
# как env контейнера. Прод-значение — пустая строка: same-origin через nginx
# (Фаза D2), все запросы идут на относительный /api/... без CORS
# (mobile-and-deployment-spec.md §0.2, backend/.env.production.example).
ARG VITE_API_URL=""
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

# Финальный слой — только собранная статика (dist/), без node_modules/исходников.
# Отдавать её будет nginx-сервис из Фазы D2: там `COPY --from=<этот образ>
# /dist /usr/share/nginx/html` (детали состыковки уточнятся в D2).
FROM scratch AS artifact
COPY --from=build /app/dist /dist
