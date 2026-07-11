// POST /api/photo/detect — фото → распознанные продукты (§6.1 «Вход A», §8).
import { useMutation } from "@tanstack/react-query";
import { api } from "./client";
import type { PhotoDetectResponse } from "./types";

export function useDetectPhoto() {
  return useMutation({
    // До 4 файлов за один вызов — все уходят в одном запросе (одно поле
    // формы, повторенное несколько раз), т.к. backend распознаёт весь набор
    // фото за один обращение к ИИ (см. services/ai/vision.ts на бэкенде).
    mutationFn: (files: File[]) => {
      const formData = new FormData();
      files.forEach((file) => formData.append("image", file));
      return api.postForm<PhotoDetectResponse>("/api/photo/detect", formData);
    },
  });
}
