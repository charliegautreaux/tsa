import Link from 'next/link';
import type { BlogPost } from '@/lib/types/content';

export function PostCard({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="block">
      <article className="glass rounded-2xl p-6 transition-all">
        <time className="text-xs text-gray-400 dark:text-gray-500">
          {new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <h2 className="mt-2 text-lg font-semibold tracking-tight">
          {post.title}
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          {post.description}
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-purple-100 px-2.5 py-0.5 text-[11px] font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </article>
    </Link>
  );
}
