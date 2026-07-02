// Идентификация пользователя (§9 спецификации): в v1 аутентификации нет.
// Анонимный id генерируется один раз на устройство, хранится в localStorage
// и отправляется в заголовке `x-user-id` на каждый запрос к API
// (см. backend/src/plugins/userId.ts — там же fallback на DEFAULT_USER_ID).
const STORAGE_KEY = "chef-assistant:userId";

export function getUserId(): string {
  let id = localStorage.getItem(STORAGE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(STORAGE_KEY, id);
  }
  return id;
}
