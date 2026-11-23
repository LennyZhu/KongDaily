import { useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { GmbFeedback } from '@/components/gmb-status';
import { AppText, EmptyState, Filters, Icon, PageHeading, Screen } from '@/components/ui';
import { ferryDeparturesToday, type FerryDeparture, type FerryPierId, type FerryServiceDayType, type FerryTimetable } from '@/ferry-data';
import { hkkfDirection, hkkfOfficialTimetableUrl, hkkfPierDisplayName, hkkfRouteName, hkkfRouteParams, hkkfSource, isHkkfDirection, type HkkfDirectionId, type HkkfRouteId } from '@/hkkf-data';
import { hkkfPreviewClient } from '@/hkkf-preview';
import { hongKongHolidaySource, isHongKongPublicHoliday } from '@/hong-kong-public-holidays';
import { useLanguage } from '@/language';
import { useNextTrainReading } from '@/next-train-hooks';
import { formatHongKongTime } from '@/next-train-time';
import { colors, radius, space, touchTarget } from '@/theme';

const directions = ['outbound', 'inbound'] as const;
type DayView = 'today' | FerryServiceDayType;

function OfficialLink({ label, url }: { label: string; url: string }) {
  const { copy } = useLanguage();
  return (
    <Pressable accessibilityRole="link" accessibilityHint={copy.compliance.externalLink} style={styles.link}
      onPress={() => { void Linking.openURL(url).catch(() => Alert.alert(copy.compliance.linkFailed)); }}>
      <Icon name="arrow.up.right" size={14} />
      <AppText variant="detail" tone="primary" style={styles.wrap}>{label}</AppText>
    </Pressable>
  );
}

function DepartureRow({ entry, fromPreviousDay }: { entry: FerryDeparture; fromPreviousDay?: boolean }) {
  const { copy: { ferry } } = useLanguage();
  const remarks = [
    entry.rule === 'optional' && ferry.optional,
    entry.rule === 'unverified' && ferry.unverified,
    entry.rule === 'saturdayOnly' && ferry.saturdayOnly,
    entry.dayOffset === 1 && (fromPreviousDay ? ferry.previousServiceDay : ferry.nextDay),
    entry.lastSailing && ferry.lastSailing,
    entry.freight && ferry.freight[entry.freight],
    entry.onwardService && ferry.onwardService,
  ].filter(Boolean);
  return (
    <View style={styles.departure}>
      <AppText variant="title" style={styles.time}>{entry.time}</AppText>
      {remarks.length > 0 && <AppText variant="detail" tone="muted" style={styles.wrap}>{remarks.join(' · ')}</AppText>}
    </View>
  );
}

function Timetable({ table, dayView, now }: { table: FerryTimetable; dayView: DayView; now: number }) {
  const { copy: { ferry }, locale } = useLanguage();
  const today = dayView === 'today' ? ferryDeparturesToday(table, now, isHongKongPublicHoliday) : undefined;
  const entries = dayView === 'today' ? (today?.entries ?? [])
    : table.entries.filter((entry) => entry.dayType === dayView)
      .sort((a, b) => (a.dayOffset ?? 2) - (b.dayOffset ?? 2) || a.time.localeCompare(b.time));
  const todayDate = dayView === 'today' ? formatHongKongTime(now).slice(0, 10) : undefined;
  const unconfirmedEntries = dayView === 'today'
    && table.entries.some(({ rule }) => rule === 'optional' || rule === 'unverified');
  const notes = table.notes[locale];

  return (
    <>
      {todayDate && <AppText variant="detail" tone="muted">{todayDate}</AppText>}
      {today?.kind === 'ready' && <View style={styles.next}>
        <AppText variant="detail" tone="primary" style={styles.wrap}>{ferry.next}</AppText>
        <AppText variant="title" tone="primary" style={styles.time}>{today.next.time}</AppText>
      </View>}
      {today?.kind === 'ended' && <AppText variant="detail" tone="muted">{ferry.ended}</AppText>}
      {!entries.length && <EmptyState icon="clock" title={today?.kind === 'calendarUnknown' || today?.kind === 'invalidDate'
        ? ferry.calendarUnknown : ferry.noDepartures} />}
      {unconfirmedEntries && <AppText variant="detail" tone="muted">{ferry.optionalNote}</AppText>}
      {entries.length > 0 && <View style={styles.card}>
        {entries.map((entry, index) => <DepartureRow key={index} entry={entry}
          fromPreviousDay={todayDate !== undefined && 'serviceDate' in entry && entry.serviceDate !== todayDate} />)}
      </View>}
      {!!notes && <View style={styles.card}>
        <AppText variant="title" accessibilityRole="header">{ferry.notes}</AppText>
        <AppText variant="detail" tone="muted">{notes}</AppText>
      </View>}
    </>
  );
}

function FerryRouteDetail({ id, client, initialDirection }: {
  id: HkkfRouteId; client: NonNullable<typeof hkkfPreviewClient>; initialDirection: HkkfDirectionId;
}) {
  const { copy, locale } = useLanguage();
  const { ferry } = copy;
  const [bound, setBound] = useState(initialDirection);
  const [dayView, setDayView] = useState<DayView>('today');
  const direction = hkkfDirection(id, bound);
  const directionPiers: Partial<Record<FerryPierId, string>> = ferry.directionPiers;
  const directionOptions = directions.map((candidate) => {
    const option = hkkfDirection(id, candidate);
    const pier = directionPiers[option.destinationPierId] ?? hkkfPierDisplayName(option.destinationPierId)?.[locale];
    return [candidate, pier ? ferry.directionTo(pier) : option.name[locale]] as const;
  });
  const read = useCallback(() => client.readTimetable(id, bound), [client, id, bound]);
  const { reading, busy, now, refresh } = useNextTrainReading(`${direction.routeId}:${bound}`, read);
  const table = reading?.payload.kind === 'ready' ? reading.payload.data : undefined;

  return (
    <Screen hasHeader>
      <PageHeading title={hkkfRouteName(id)[locale]} description={hkkfSource.owner[locale]} />
      <View style={styles.section}>
        <AppText variant="title" accessibilityRole="header">{ferry.direction}</AppText>
        <Filters options={directionOptions} selected={bound} onSelect={setBound} singleLine />
        <View style={styles.card}>
          <AppText variant="detail" tone="muted">{ferry.from}</AppText>
          <AppText variant="title">{hkkfPierDisplayName(direction.originPierId)?.[locale]}</AppText>
          <AppText variant="detail" tone="muted">{ferry.to}</AppText>
          <AppText variant="title">{hkkfPierDisplayName(direction.destinationPierId)?.[locale]}</AppText>
        </View>
      </View>
      <View style={styles.section}>
        <View>
          <AppText variant="homeHeading" accessibilityRole="header">{ferry.scheduled}</AppText>
          <AppText variant="detail" tone="muted">{ferry.hongKongTime}</AppText>
        </View>
        <Filters options={(['today', 'mondayToSaturday', 'sundayOrPublicHoliday'] as const)
          .map((view) => [view, ferry[view]] as const)} selected={dayView} onSelect={setDayView} />
        {busy && <GmbFeedback text={ferry.loadingSchedule} busy />}
        {reading && !table && !busy && <GmbFeedback text={ferry.scheduleFailed} onRetry={refresh} />}
        {table && <Timetable table={table} dayView={dayView} now={now.wall} />}
      </View>
      <View style={styles.card}>
        <AppText variant="title" accessibilityRole="header">{ferry.source}</AppText>
        <OfficialLink label={ferry.operatorTimetable} url={hkkfOfficialTimetableUrl(id)} />
        <OfficialLink label={hkkfSource.attribution[locale]} url={hkkfSource.dataset} />
        <OfficialLink label={ferry.calendarSource} url={hongKongHolidaySource} />
      </View>
    </Screen>
  );
}

export default function FerryScreen() {
  const { id, operatorId, direction } = useLocalSearchParams<{ id?: string; operatorId?: string; direction?: string }>();
  const { copy: { ferry } } = useLanguage();
  const route = hkkfRouteParams(operatorId, id);
  if (!hkkfPreviewClient || route === undefined) return <Screen hasHeader>
    <EmptyState icon="ferry" title={ferry.unavailable} />
  </Screen>;
  const initialDirection = isHkkfDirection(direction) ? direction : 'outbound';
  return <FerryRouteDetail key={`${route}:${initialDirection}`} id={route} client={hkkfPreviewClient} initialDirection={initialDirection} />;
}

const styles = StyleSheet.create({
  section: { gap: space.md },
  card: { gap: space.sm, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.surface,
    borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth },
  next: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: space.sm,
    backgroundColor: colors.tint, borderRadius: radius.control, padding: space.md },
  departure: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md, alignItems: 'baseline', paddingVertical: space.xs },
  time: { fontVariant: ['tabular-nums'] },
  wrap: { flexShrink: 1 },
  link: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: touchTarget },
});
