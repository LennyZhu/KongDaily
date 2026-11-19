import { StyleSheet, View } from 'react-native';

import { colors, homeColors } from '@/theme';

const skyline = [
  { left: 44, width: 11, height: 13 },
  { left: 58, width: 14, height: 21 },
  { left: 75, width: 10, height: 16 },
  { left: 88, width: 14, height: 26 },
  { left: 105, width: 10, height: 20 },
  { left: 137, width: 10, height: 18 },
  { left: 177, width: 11, height: 20 },
  { left: 191, width: 14, height: 13 },
];

export function SearchHarbourIllustration() {
  return (
    <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      pointerEvents="none" style={styles.scene}>
      <View style={styles.backHill} />
      <View style={styles.frontHill} />
      {skyline.map(({ left, width, height }, index) => (
        <View key={left} style={[styles.building, index % 2 === 0 && styles.lightBuilding, { left, width, height }]} />
      ))}
      <View style={styles.ifc}>
        <View style={styles.ifcHighlight} />
      </View>
      <View style={styles.bankOfChina}>
        <View style={styles.towerMast} />
        <View style={[styles.towerMast, styles.shortMast]} />
        <View style={styles.towerCrown} />
        <View style={styles.towerFace}>
          <View style={styles.towerBrace} />
          <View style={[styles.towerBrace, styles.lowerBrace]} />
        </View>
      </View>
      <View style={styles.hillWaterline} />
      <View style={styles.harbour}>
        <View style={styles.ripple} />
        <View style={[styles.ripple, styles.shortRipple]} />
      </View>
      <View style={styles.quay} />
      <View style={styles.ferry}>
        <View style={styles.funnel} />
        <View style={styles.ferryCabin}>
          {[0, 1, 2, 3].map((pane) => <View key={pane} style={styles.ferryWindow} />)}
        </View>
        <View style={styles.hull} />
      </View>
      <View style={styles.bus}>
        <View style={styles.busBody}>
          {[0, 1].map((deck) => (
            <View key={deck} style={styles.busDeck}>
              {[0, 1, 2].map((pane) => <View key={pane} style={styles.busWindow} />)}
              <View style={[styles.busWindow, styles.busWindshield]} />
            </View>
          ))}
          <View style={styles.busSkirt} />
        </View>
        <View style={styles.wheel} />
        <View style={[styles.wheel, styles.frontWheel]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scene: { width: 224, maxWidth: '100%', height: 88, overflow: 'hidden' },
  backHill: { position: 'absolute', left: 13, top: 29, width: 130, height: 47, borderRadius: 70,
    backgroundColor: colors.tint, transform: [{ rotate: '-9deg' }] },
  frontHill: { position: 'absolute', left: 72, top: 27, width: 139, height: 49, borderRadius: 72,
    backgroundColor: colors.primarySoft, opacity: 0.22, transform: [{ rotate: '9deg' }] },
  building: { position: 'absolute', bottom: 25, borderTopLeftRadius: 2, borderTopRightRadius: 2,
    backgroundColor: colors.primarySoft, opacity: 0.36 },
  lightBuilding: { opacity: 0.24 },
  ifc: { position: 'absolute', left: 119, bottom: 25, width: 15, height: 52, borderTopLeftRadius: 8,
    borderTopRightRadius: 8, overflow: 'hidden', backgroundColor: colors.primarySoft, opacity: 0.72 },
  ifcHighlight: { position: 'absolute', top: 4, bottom: 0, left: 3, width: 2, backgroundColor: colors.onPrimaryMuted },
  bankOfChina: { position: 'absolute', left: 152, bottom: 25, width: 19, height: 45, opacity: 0.64 },
  towerMast: { position: 'absolute', top: 1, right: 2, width: 1, height: 12, backgroundColor: colors.primarySoft },
  shortMast: { top: 5, right: 6, height: 8 },
  towerCrown: { position: 'absolute', top: 10, right: 0, width: 0, height: 0,
    borderLeftWidth: 19, borderBottomWidth: 11, borderLeftColor: 'transparent', borderBottomColor: colors.primarySoft },
  towerFace: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 24,
    overflow: 'hidden', backgroundColor: colors.primarySoft },
  towerBrace: { position: 'absolute', width: 24, height: 1, top: 6, left: -2, backgroundColor: colors.onPrimary,
    transform: [{ rotate: '-49deg' }] },
  lowerBrace: { top: 16, transform: [{ rotate: '42deg' }] },
  hillWaterline: { position: 'absolute', left: 12, right: 10, bottom: 12, height: 13, backgroundColor: colors.searchBackground },
  harbour: { position: 'absolute', left: 15, right: 8, bottom: 7, height: 20, borderRadius: 10,
    backgroundColor: colors.onPrimaryMuted },
  ripple: { position: 'absolute', left: 96, bottom: 7, width: 29, height: 1, borderRadius: 1, backgroundColor: colors.primarySoft, opacity: 0.32 },
  shortRipple: { left: 183, bottom: 10, width: 9 },
  quay: { position: 'absolute', left: 7, bottom: 2, width: 86, height: 10, borderRadius: 8, backgroundColor: homeColors.cream },
  ferry: { position: 'absolute', left: 145, bottom: 9, width: 49, height: 20 },
  ferryCabin: { position: 'absolute', left: 7, bottom: 6, width: 35, height: 10, borderTopLeftRadius: 3,
    borderTopRightRadius: 3, paddingHorizontal: 3, alignItems: 'center', gap: 2, flexDirection: 'row', backgroundColor: colors.surface },
  ferryWindow: { height: 4, borderRadius: 1, flex: 1, backgroundColor: colors.primarySoft },
  funnel: { position: 'absolute', left: 25, bottom: 15, width: 5, height: 5, borderTopWidth: 2,
    borderColor: colors.primary, backgroundColor: homeColors.cream },
  hull: { position: 'absolute', bottom: 0, width: 49, height: 7, borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8, backgroundColor: colors.primary },
  bus: { position: 'absolute', left: 16, bottom: 4, width: 69, height: 37 },
  busBody: { height: 32, paddingTop: 3, paddingHorizontal: 3, gap: 3, overflow: 'hidden', borderRadius: 5,
    borderWidth: 1, borderColor: colors.primarySoft, backgroundColor: homeColors.cream },
  busDeck: { height: 8, flexDirection: 'row', gap: 2 },
  busWindow: { flex: 1, borderRadius: 1, backgroundColor: colors.primarySoft },
  busWindshield: { flex: 1.18, backgroundColor: colors.primary },
  busSkirt: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, backgroundColor: colors.primarySoft },
  wheel: { position: 'absolute', left: 9, bottom: 0, width: 10, height: 10, borderRadius: 5,
    borderWidth: 3, borderColor: colors.primary, backgroundColor: homeColors.cream },
  frontWheel: { left: 50 },
});
