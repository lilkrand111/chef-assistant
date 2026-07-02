-- Восстанавливает GIN-trgm индекс, удалённый миграцией 20260701211840_dev (§13
-- «известное отклонение»). CREATE EXTENSION IF NOT EXISTS — идемпотентно на
-- случай применения на уже существующей БД, где расширение включено migration'ом
-- 20260701155641_pg_trgm_index. Индекс теперь также объявлен в schema.prisma
-- (extendedIndexes, @@index с ops: raw("gin_trgm_ops"), type: Gin) — это и есть
-- фикс первопричины: migrate dev больше не считает индекс "лишним" при diff'е
-- против shadow-БД, поэтому следующее неродственное изменение схемы его не удалит.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX ingredient_name_trgm ON "Ingredient" USING gin ("nameNormalized" gin_trgm_ops);
