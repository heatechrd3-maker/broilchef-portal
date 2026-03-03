import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: '/broilchef-portal/', // 加入這一行
  plugins: [
    react(),
    tailwindcss(),
  ],
});
