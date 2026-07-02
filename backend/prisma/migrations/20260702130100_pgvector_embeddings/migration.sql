-- pgvector: локальные эмбеддинги имён ингредиентов для семантического матчинга
-- (§7.1 шаг 4, Фаза 5). Требует образ Postgres с pgvector (docker-compose.yml
-- переключён на pgvector/pgvector:pg16).
--
-- Размерность 768 фиксирована под модель Xenova/LaBSE (services/ai/embed.ts,
-- AI_EMBED_MODEL) — выбрана после сравнения с более лёгкой paraphrase-
-- multilingual-MiniLM-L12-v2 (384-мерной), которая на реальной проверке путала
-- ранжирование ближайшего соседа для редких слов (см. §13 «Фаза 5»). При смене
-- модели на другую размерность нужна новая миграция (ALTER COLUMN TYPE) +
-- пересчёт эмбеддингов всех ингредиентов.
--
-- HNSW выбран вместо ivfflat: ivfflat строит кластеры (centroids) один раз при
-- CREATE INDEX и на пустой таблице (как здесь — колонка ещё не заполнена, это
-- сделает seed) дал бы один вырожденный кластер на весь каталог, требуя REINDEX
-- после загрузки данных. HNSW строится инкрементально по мере вставки строк и не
-- имеет этой проблемы — на каталоге масштаба ~300 строк разница в скорости поиска
-- не важна, а корректность из коробки важнее.
--
-- ВАЖНО (эксплуатационное правило, зафиксировано в §13 спеки): Prisma не умеет
-- объявлять индексы типа Hnsw/Ivfflat в schema.prisma ни в одной версии (в
-- отличие от GIN, см. соседнюю миграцию) — это открытое ограничение Prisma
-- (github.com/prisma/prisma/issues/27770, /issues/28414). Поэтому этот индекс
-- НЕ защищён от удаления так, как ingredient_name_trgm: обычный `prisma migrate
-- dev` (auto-diff режим) при следующем изменении схемы сгенерирует для него
-- DROP INDEX, ничего не спрашивая. Правило: после этой миграции menять схему
-- только через `prisma migrate dev --create-only` с ручной проверкой SQL-диффа
-- перед применением (и ручным удалением DROP INDEX ingredient_embedding_hnsw_idx,
-- если он появится), либо писать миграции руками и применять через
-- `prisma migrate deploy` / `prisma migrate resolve --applied`.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "Ingredient" ADD COLUMN "embedding" vector(768);

CREATE INDEX ingredient_embedding_hnsw_idx ON "Ingredient" USING hnsw ("embedding" vector_cosine_ops);
