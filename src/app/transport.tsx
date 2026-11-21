import { useLocalSearchParams } from 'expo-router';

import NearbyBusScreen from '@/app/bus/nearby';

export default function TransportScreen() {
  const { intent } = useLocalSearchParams<{ intent?: string }>();
  return <NearbyBusScreen transport addFrequentRoute={intent === 'add-frequent-route'} />;
}
