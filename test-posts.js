#!/usr/bin/env node
import { getCollection } from 'astro:content';

// This won't work directly, let's create a simple test
console.log('Testing post slugs...');

import fs from 'fs';
import path from 'path';

const postsDir = './src/content/posts';
const files = fs.readdirSync(postsDir);

console.log('\nPost files:');
files.filter(f => f.endsWith('.md')).forEach(f => {
  const id = f;
  const slug = id.replace(/\.md$/, '');
  console.log(`  File: ${f}`);
  console.log(`  ID: ${id}`);
  console.log(`  Slug: ${slug}`);
  console.log();
});
