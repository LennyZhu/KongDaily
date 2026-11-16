import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#246F69',
  primarySoft: '#3B8F87',
  background: '#F6F9F7',
  tintedBackground: '#E6F3F1',
  surface: '#FFFFFF',
  text: '#243330',
  textSecondary: '#76807C',
  border: '#E3E9E6',
  muted: '#546762',
  tint: '#E5F1ED',
  pressed: '#EDF4F1',
  onPrimary: '#FFFFFF',
  onPrimaryMuted: '#DEEFEB',
  error: '#9C352D',
};

export const homeColors = {
  harbourSky: '#DEF1F8',
  harbourVeil: 'rgba(222, 241, 248, 0.90)',
  harbourWash: 'rgba(222, 241, 248, 0)',
  pageWash: 'rgba(246, 249, 247, 0)',
  weatherBright: '#2A7178',
  weatherDeep: '#155D63',
  weatherIcon: '#D8F4F5',
  weatherDivider: 'rgba(222, 239, 235, 0.42)',
  weatherWave: 'rgba(174, 235, 232, 0.18)',
  weatherWaveLight: 'rgba(174, 235, 232, 0.11)',
  busEmpty: '#EAF0F1',
  cream: '#F6F1E6',
  peach: '#F9EEE8',
  green: '#EBF3E8',
  blue: '#E4F1F8',
  lavender: '#E9EDF8',
  rustInk: '#A44B37',
  greenInk: '#356A42',
  blueInk: '#226488',
  photoClear: 'rgba(13, 29, 24, 0)',
  photoShade: 'rgba(13, 29, 24, 0.50)',
  photoInk: 'rgba(13, 29, 24, 0.90)',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, section: 32 };
export const radius = { control: 12, card: 16, media: 18, largeCard: 20, pill: 100 };
export const touchTarget = 44;

export const homeLayout = {
  gutter: space.xl,
  sectionGap: space.xl,
  brandMark: 46,
  searchHeight: 54,
  weatherHeight: 112,
  quickLinkHeight: 90,
  featuredHeight: 156,
  featuredCaptionTop: 92,
};

export const floatingTab = {
  height: 62,
  horizontalMargin: space.xl,
  bottomGap: space.sm,
  background: '#F3F6F5',
  selected: '#CEE8E6',
};

export const shadows = {
  search: { shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.13, shadowRadius: 9 },
  tabBar: { shadowColor: colors.text, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.16, shadowRadius: 13 },
};

export const typography = StyleSheet.create({
  display: { fontSize: 34, fontWeight: '700', letterSpacing: -0.8 },
  brand: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  moduleTitle: { fontSize: 27, fontWeight: '700', letterSpacing: -0.45 },
  brandSubtitle: { fontSize: 13 },
  homeHeading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.25 },
  homeCardTitle: { fontSize: 16, fontWeight: '700' },
  weatherTitle: { fontSize: 18, fontWeight: '700' },
  section: { fontSize: 22, fontWeight: '700', letterSpacing: -0.25 },
  title: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 17 },
  detail: { fontSize: 14 },
  caption: { fontSize: 12, fontWeight: '600' },
  tab: { fontSize: 11, fontWeight: '600' },
});
