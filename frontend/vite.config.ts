import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// Эмеральдовая тема интерфейса (спека М3): акцент bg-emerald-600 (#059669),
// фон приложения bg-gray-50 (#f9fafb, см. App.tsx).
const THEME_COLOR = "#059669";
const BACKGROUND_COLOR = "#f9fafb";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["apple-touch-icon.png"],
      manifest: {
        name: "ИИ-помощник шефа",
        short_name: "Шеф",
        description: "Подбор блюд по продуктам, меню на день и список покупок",
        lang: "ru",
        display: "standalone",
        start_url: "/",
        scope: "/",
        theme_color: THEME_COLOR,
        background_color: BACKGROUND_COLOR,
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        // Прекэшируем только собранный app shell (JS/CSS/иконки/шрифты) —
        // дефолтный globPatterns плагина это покрывает.
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff,woff2}"],
        // /api/* — НИКОГДА не кэшировать (спека §9: ответы зависят от
        // заголовка x-user-id и постоянно меняются — список покупок, меню,
        // сохранённые; кэш сломал бы актуальность и мог бы "перепутать"
        // данные разных анонимных пользователей).
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^\/api\//,
            handler: "NetworkOnly",
          },
        ],
      },
    }),
  ],
});
