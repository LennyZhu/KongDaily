import { createHkkfClient } from '@/hkkf-client';

// App Store and other release bundles stay disabled pending operator authorization.
export const hkkfPreviewEnabled = typeof __DEV__ !== 'undefined' && __DEV__
  && process.env.EXPO_PUBLIC_HKKF_PREVIEW === '1';
export const hkkfPreviewClient = hkkfPreviewEnabled ? createHkkfClient({ enabled: true }) : undefined;
