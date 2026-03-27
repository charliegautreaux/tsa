import { Shield } from 'lucide-react';
import { AffiliateDisclosure } from './disclosure';

export function PreCheckCTA({ waitMinutes }: { waitMinutes?: number }) {
  const showUrgent = waitMinutes != null && waitMinutes > 15;

  return (
    <div className="glass rounded-2xl p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-600/10">
          <Shield className="h-4 w-4 text-green-500" />
        </div>
        <div>
          <p className="text-sm font-medium">
            {showUrgent
              ? `Skip the ${waitMinutes}-minute wait with TSA PreCheck`
              : 'Skip the line with TSA PreCheck'}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            PreCheck members wait under 5 minutes on average. Many travel cards
            reimburse the $78 enrollment fee.
          </p>
          <a
            href="/blog/tsa-precheck-vs-clear"
            className="mt-2 inline-block text-sm font-medium text-purple-600 hover:underline dark:text-purple-400"
          >
            See cards that cover PreCheck →
          </a>
          <div className="mt-2">
            <AffiliateDisclosure />
          </div>
        </div>
      </div>
    </div>
  );
}
