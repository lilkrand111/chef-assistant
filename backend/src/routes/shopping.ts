// GET/POST/PATCH/DELETE /api/shopping* (§6.4, §8 спецификации).
import type { FastifyPluginAsync } from "fastify";
import type { Ingredient, ShoppingItem, ShoppingItemSource } from "@prisma/client";
import { IngredientCategory } from "@prisma/client";
import { prisma } from "../db";
import { ApiError } from "../lib/errors";
import {
  addShoppingItemSchema,
  dishIdParamSchema,
  fromDishBodySchema,
  patchShoppingItemSchema,
  shoppingIdParamSchema,
} from "../schemas/shopping";
import { matchIngredient } from "../services/matching";

// Порядок групп в ответе GET /api/shopping — по порядку объявления enum.
const CATEGORY_ORDER = Object.values(IngredientCategory);

type ShoppingItemWithIngredient = ShoppingItem & { ingredient: Ingredient | null };

function serializeShoppingItem(item: ShoppingItemWithIngredient) {
  return {
    id: item.id,
    ingredientId: item.ingredientId,
    name: item.customName ?? item.ingredient?.name ?? "",
    category: item.category,
    amount: item.amount,
    unit: item.unit,
    checked: item.checked,
    source: item.source,
    createdAt: item.createdAt,
  };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

// Один и тот же ингредиент может понадобиться из нескольких блюд (напр. банан
// и в завтраке, и в перекусе) — вместо второй отдельной строки в списке
// покупок количество суммируется в уже существующую позицию по ingredientId.
async function addOrMergeShoppingItem(params: {
  userId: string;
  ingredientId: string;
  category: IngredientCategory;
  amount: number | null;
  unit: string;
  source: ShoppingItemSource;
}): Promise<{ item: ShoppingItemWithIngredient; created: boolean }> {
  const existing = await prisma.shoppingItem.findFirst({
    where: { userId: params.userId, ingredientId: params.ingredientId },
    include: { ingredient: true },
  });

  if (!existing) {
    const created = await prisma.shoppingItem.create({
      data: {
        userId: params.userId,
        ingredientId: params.ingredientId,
        category: params.category,
        amount: params.amount,
        unit: params.unit,
        source: params.source,
      },
      include: { ingredient: true },
    });
    return { item: created, created: true };
  }

  // Позиция, уже отмеченная купленной, считается закрытой: новое добавление
  // начинает её заново с этим количеством вместо суммирования поверх уже
  // купленного и снимает отметку "куплено", т.к. появилась новая потребность.
  if (existing.checked) {
    const restarted = await prisma.shoppingItem.update({
      where: { id: existing.id },
      data: { amount: params.amount, unit: params.unit, checked: false },
      include: { ingredient: true },
    });
    return { item: restarted, created: false };
  }

  const mergedAmount =
    existing.amount != null && params.amount != null
      ? round1(existing.amount + params.amount)
      : (existing.amount ?? params.amount);

  const updated = await prisma.shoppingItem.update({
    where: { id: existing.id },
    data: { amount: mergedAmount },
    include: { ingredient: true },
  });
  return { item: updated, created: false };
}

const shoppingRoutes: FastifyPluginAsync = async (app) => {
  app.get("/api/shopping", async (request) => {
    const items = await prisma.shoppingItem.findMany({
      where: { userId: request.userId },
      include: { ingredient: true },
      orderBy: { createdAt: "asc" },
    });

    const byCategory = new Map<string, ShoppingItemWithIngredient[]>();
    for (const item of items) {
      const list = byCategory.get(item.category) ?? [];
      list.push(item);
      byCategory.set(item.category, list);
    }

    const groups = CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => ({
      category,
      items: byCategory.get(category)!.map(serializeShoppingItem),
    }));

    return { groups };
  });

  app.post("/api/shopping/item", async (request, reply) => {
    const body = addShoppingItemSchema.parse(request.body);

    if (body.ingredientId) {
      const ingredient = await prisma.ingredient.findUnique({ where: { id: body.ingredientId } });
      if (!ingredient) {
        throw new ApiError(404, "INGREDIENT_NOT_FOUND", "Ингредиент не найден");
      }
      const { item, created } = await addOrMergeShoppingItem({
        userId: request.userId,
        ingredientId: ingredient.id,
        category: ingredient.category,
        amount: body.amount ?? null,
        unit: body.unit ?? ingredient.defaultUnit,
        source: "MANUAL",
      });
      reply.status(created ? 201 : 200);
      return serializeShoppingItem(item);
    }

    // body.name гарантирован схемой (refine: ingredientId либо name).
    const name = body.name!;
    const match = await matchIngredient(name);

    if (!match) {
      // ЗАГЛУШКА ДО ФАЗЫ 3: ИИ-классификация неизвестных ингредиентов ещё не
      // реализована (§7.6, Фаза 3 плана). Пока честно отдаём ошибку вместо
      // того, чтобы молча класть в OTHER — так не плодим мусорные категории,
      // которые потом придётся переклассифицировать.
      throw new ApiError(
        422,
        "INGREDIENT_NOT_CLASSIFIED",
        `Ингредиент «${name}» не найден в базе. Автоматическая категоризация появится в Фазе 3 — пока можно добавить существующий ингредиент из автокомплита.`
      );
    }

    const { item, created } = await addOrMergeShoppingItem({
      userId: request.userId,
      ingredientId: match.ingredient.id,
      category: match.ingredient.category,
      amount: body.amount ?? null,
      unit: body.unit ?? match.ingredient.defaultUnit,
      source: "MANUAL",
    });
    reply.status(created ? 201 : 200);
    return serializeShoppingItem(item);
  });

  app.post("/api/shopping/from-dish/:dishId", async (request) => {
    const { dishId } = dishIdParamSchema.parse(request.params);
    const body = fromDishBodySchema.parse(request.body ?? {});

    const dish = await prisma.dish.findUnique({
      where: { id: dishId },
      include: { ingredients: { include: { ingredient: true } } },
    });
    if (!dish) {
      throw new ApiError(404, "DISH_NOT_FOUND", "Блюдо не найдено");
    }

    const selected =
      body.ingredientIds && body.ingredientIds.length > 0
        ? dish.ingredients.filter((di) => body.ingredientIds!.includes(di.ingredientId))
        : dish.ingredients;

    if (selected.length === 0) {
      throw new ApiError(400, "NO_INGREDIENTS_SELECTED", "Не выбрано ни одного ингредиента блюда");
    }

    const scale = body.scale ?? 1;

    // Через addOrMergeShoppingItem, а не createMany: тот же ингредиент может
    // уже лежать в списке (из другого блюда или добавлен вручную) — нужно
    // суммировать количество в существующую позицию, а не плодить дубликаты
    // строк для одного ingredientId (иначе последующее точечное удаление не
    // сможет однозначно найти "свою" позицию — см. DishCard.tsx/MenuPage.tsx).
    await Promise.all(
      selected.map((di) =>
        addOrMergeShoppingItem({
          userId: request.userId,
          ingredientId: di.ingredientId,
          category: di.ingredient.category,
          amount: round1(di.amount * scale),
          unit: di.unit,
          source: "FROM_DISH",
        })
      )
    );

    return { added: selected.length };
  });

  app.patch("/api/shopping/:id", async (request) => {
    const { id } = shoppingIdParamSchema.parse(request.params);
    const body = patchShoppingItemSchema.parse(request.body);

    const existing = await prisma.shoppingItem.findFirst({ where: { id, userId: request.userId } });
    if (!existing) {
      throw new ApiError(404, "SHOPPING_ITEM_NOT_FOUND", "Позиция списка покупок не найдена");
    }

    const updated = await prisma.shoppingItem.update({
      where: { id },
      data: {
        ...(body.checked !== undefined ? { checked: body.checked } : {}),
        ...(body.amount !== undefined ? { amount: body.amount } : {}),
        ...(body.unit !== undefined ? { unit: body.unit } : {}),
      },
      include: { ingredient: true },
    });

    return serializeShoppingItem(updated);
  });

  app.delete("/api/shopping/:id", async (request) => {
    const { id } = shoppingIdParamSchema.parse(request.params);
    await prisma.shoppingItem.deleteMany({ where: { id, userId: request.userId } });
    return { ok: true };
  });

  app.delete("/api/shopping", async (request) => {
    await prisma.shoppingItem.deleteMany({ where: { userId: request.userId } });
    return { ok: true };
  });
};

export default shoppingRoutes;
