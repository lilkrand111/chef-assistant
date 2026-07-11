// Сжатие фото на клиенте перед загрузкой (§6.1 «Вход A»). Без этого шага
// по мобильной сети уходит оригинал с телефона (часто 10-20+ МБ) — именно
// его загрузка, а не распознавание, и создаёт ощущение "зависания" на
// медленном мобильном интернете. Backend всё равно перекодирует/уменьшает
// повторно (routes/photo.ts) — это осознанное дублирование ради разных
// целей: здесь экономим время передачи по сети, там — гарантируем
// одинаковый результат независимо от клиента.
const MAX_DIMENSION = 1280;
const JPEG_QUALITY = 0.8;

export async function compressImage(file: File): Promise<File> {
  try {
    // imageOrientation по умолчанию "from-image" (учитывает EXIF-поворот) —
    // ориентация фото с телефона сохранится правильной без ручной обработки.
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY)
    );
    if (!blob) return file;

    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    // Не смогли сжать (неподдерживаемый формат/браузер) — отправляем
    // оригинал как есть, backend сам разберётся или вернёт понятную ошибку.
    return file;
  }
}
