import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import type { BlogPost } from '@/lib/types/content';

const BLOG_DIR = path.join(process.cwd(), 'src/content/blog');

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter((f) => f.endsWith('.md'));

  const posts = files.map((file) => {
    const slug = file.replace(/\.md$/, '');
    const raw = fs.readFileSync(path.join(BLOG_DIR, file), 'utf-8');
    const { data, content } = matter(raw);

    return {
      slug,
      title: data.title ?? slug,
      description: data.description ?? '',
      date: data.date ?? '',
      tags: data.tags ?? [],
      content,
    } satisfies BlogPost;
  });

  return posts.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(raw);

  return {
    slug,
    title: data.title ?? slug,
    description: data.description ?? '',
    date: data.date ?? '',
    tags: data.tags ?? [],
    content,
  };
}
