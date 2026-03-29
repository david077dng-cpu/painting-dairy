import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  // 部署到 VPS
  site: 'https://xlilian.cn',
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  build: {
    inlineStylesheets: 'always',
  },
});
