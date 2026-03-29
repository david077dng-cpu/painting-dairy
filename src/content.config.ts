import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.union([z.string(), z.date()]).transform((val) =>
      val instanceof Date ? val.toISOString().split('T')[0] : val
    ),
    description: z.string().optional(),
    category: z.string().optional(),
  }),
});

const groups = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/group' }),
  schema: z.object({
    title: z.string(),
    date: z.union([z.string(), z.date()]).transform((val) =>
      val instanceof Date ? val.toISOString().split('T')[0] : val
    ),
    description: z.string().optional(),
  }),
});

export const collections = { posts, groups };
