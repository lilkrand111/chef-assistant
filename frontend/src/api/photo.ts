// POST /api/photo/detect — фото → распознанные продукты (§6.1 «Вход A», §8).
import { useMutation } from "@tanstack/react-query";
import { api } from "./client";
import type { PhotoDetectResponse } from "./types";

export function useDetectPhoto() {
  return useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      return api.postForm<PhotoDetectResponse>("/api/photo/detect", formData);
    },
  });
}
