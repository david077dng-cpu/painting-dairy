import { defineConfig } from 'astro/config';

export default defineConfig({
  // 部署到 VPS
  site: 'https://xlilian.art',
  build: {
    inlineStylesheets: 'always',
  },
});
