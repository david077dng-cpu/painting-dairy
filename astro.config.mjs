import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  // 部署到 VPS
  site: 'https://xlilian.art',
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  build: {
    inlineStylesheets: 'always',
  },
});
