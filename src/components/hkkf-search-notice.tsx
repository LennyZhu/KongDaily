import { GmbFeedback } from '@/components/gmb-status';
import type { HkkfSearchState } from '@/hkkf-search';
import { useLanguage } from '@/language';

export function HkkfSearchNotice({ state, retry }: { state?: HkkfSearchState; retry: () => void }) {
  const { copy: { ferry } } = useLanguage();
  if (state?.status === 'loading') return <GmbFeedback text={ferry.loading} busy />;
  if (state?.status === 'failed') return <GmbFeedback text={ferry.searchFailed} onRetry={retry} />;
  return null;
}
