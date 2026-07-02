-- Расширение для нечёткого поиска ингредиентов (§4.2, §7.1 спецификации).
-- Prisma не умеет создавать GIN-trgm индексы декларативно, поэтому raw SQL.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX ingredient_name_trgm ON "Ingredient" USING gin ("nameNormalized" gin_trgm_ops);
