import { describe, it, expect } from 'vitest';
import { getAllPosts, getPostBySlug } from '@/lib/content/blog';

describe('blog content parser', () => {
  it('returns all posts sorted by date descending', () => {
    const posts = getAllPosts();
    expect(posts.length).toBeGreaterThanOrEqual(1);
    expect(posts[0].slug).toBe('tsa-precheck-vs-clear');
    expect(posts[0].title).toContain('TSA PreCheck vs CLEAR');
    expect(posts[0].tags).toContain('precheck');
  });

  it('returns a post by slug', () => {
    const post = getPostBySlug('tsa-precheck-vs-clear');
    expect(post).not.toBeNull();
    expect(post!.title).toContain('TSA PreCheck vs CLEAR');
    expect(post!.content).toContain('## TSA PreCheck vs CLEAR');
  });

  it('returns null for missing slug', () => {
    const post = getPostBySlug('does-not-exist');
    expect(post).toBeNull();
  });
});
