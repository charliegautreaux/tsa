import type { Metadata } from 'next';
import { getAllPosts } from '@/lib/content/blog';
import { PostCard } from '@/components/blog/post-card';

export const metadata: Metadata = {
  title: 'Blog — PreBoard',
  description:
    'Airport security tips, TSA PreCheck guides, and travel advice from PreBoard.',
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:py-10">
      <h1 className="gradient-text text-4xl font-bold tracking-tight">Blog</h1>
      <p className="mt-3 text-gray-500 dark:text-gray-400">
        Airport security tips, guides, and travel advice.
      </p>

      <div className="mt-8 space-y-4">
        {posts.length === 0 ? (
          <p className="text-gray-400">No posts yet. Check back soon.</p>
        ) : (
          posts.map((post) => <PostCard key={post.slug} post={post} />)
        )}
      </div>
    </main>
  );
}
