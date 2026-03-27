import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import { getAllPosts, getPostBySlug } from '@/lib/content/blog';
import { ArticleJsonLd } from '@/components/seo/json-ld';
import { AdSlot } from '@/components/ads/ad-slot';

export function generateStaticParams() {
  return getAllPosts().map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.title} — PreBoard`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
      publishedTime: post.date,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <ArticleJsonLd
        title={post.title}
        description={post.description}
        url={`https://preboard.cgautreauxnc.workers.dev/blog/${slug}`}
        datePublished={post.date}
      />

      <Link
        href="/blog"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-900 dark:hover:text-gray-100"
      >
        <ArrowLeft className="h-4 w-4" />
        All posts
      </Link>

      <article>
        <time className="text-sm text-gray-400 dark:text-gray-500">
          {new Date(post.date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </time>
        <h1 className="gradient-text mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {post.title}
        </h1>

        <div className="my-8 flex justify-center">
          <AdSlot id={`blog-${slug}-top`} size="leaderboard" />
        </div>

        <div
          className="prose prose-gray max-w-none dark:prose-invert prose-headings:font-semibold prose-a:text-purple-600 dark:prose-a:text-purple-400"
          dangerouslySetInnerHTML={{ __html: markdownToHtml(post.content) }}
        />
      </article>
    </main>
  );
}

/** Minimal markdown → HTML. Handles headings, paragraphs, bold, italic, links, tables, lists. */
function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    .replace(
      /\|(.+)\|\n\|[-| ]+\|\n((?:\|.+\|\n?)+)/g,
      (_match, header: string, body: string) => {
        const ths = header.split('|').filter(Boolean).map((h: string) => `<th>${h.trim()}</th>`).join('');
        const rows = body.trim().split('\n').map((row: string) => {
          const tds = row.split('|').filter(Boolean).map((d: string) => `<td>${d.trim()}</td>`).join('');
          return `<tr>${tds}</tr>`;
        }).join('');
        return `<table><thead><tr>${ths}</tr></thead><tbody>${rows}</tbody></table>`;
      }
    )
    .replace(/^(?!<[hultod])((?!<).+)$/gm, '<p>$1</p>')
    .replace(/<p><\/p>/g, '')
    .replace(/\n{2,}/g, '\n');
}
