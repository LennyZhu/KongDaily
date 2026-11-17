import type { Region } from 'react-native-maps';

const gestureWindow = 1_800;
const animationWindow = 900;

function centerShift(a: Region, b: Region) {
  const longitude = ((b.longitude - a.longitude + 540) % 360) - 180;
  return Math.max(Math.abs(b.latitude - a.latitude), Math.abs(longitude));
}

function zoomShift(a: Region, b: Region) {
  return Math.abs(Math.log(b.longitudeDelta / a.longitudeDelta));
}

export function hasMeaningfulMapChange(origin: Region, next: Region) {
  const threshold = Math.max(0.00005, Math.min(0.0005, Math.min(origin.latitudeDelta, origin.longitudeDelta) * 0.04));
  return centerShift(origin, next) >= threshold || zoomShift(origin, next) >= Math.log(1.15);
}

export function createNearbyMapMotion(initialRegion: Region) {
  let visible = initialRegion;
  let lastNativeRegion = initialRegion;
  let gesture: { origin: Region; lastInput: number } | undefined;
  let animation: { target: Region; expires: number; settled: boolean } | undefined;

  return {
    getVisible: () => visible,
    endGesture() {
      gesture = undefined;
    },
    noteGesture(now: number) {
      if (!gesture || now - gesture.lastInput > gestureWindow) gesture = { origin: lastNativeRegion, lastInput: now };
      else gesture.lastInput = now;
    },
    moveCamera(target: Region, now: number) {
      gesture = undefined;
      animation = { target, expires: now + animationWindow, settled: false };
      visible = target;
    },
    change(next: Region, now: number, complete: boolean) {
      if (![next.latitude, next.longitude, next.latitudeDelta, next.longitudeDelta].every(Number.isFinite)
        || next.latitudeDelta <= 0 || next.longitudeDelta <= 0) return;

      const userInput = gesture && now - gesture.lastInput <= gestureWindow ? gesture : undefined;
      if (animation && now >= animation.expires) animation = undefined;
      const matchesTarget = animation && centerShift(animation.target, next) < 0.0002;
      // MapKit fits the requested span to its aspect ratio. A clear zoom following user input
      // can still be meaningful at the animation's target center, including just after settling.
      const atProgrammaticTarget = matchesTarget && (!userInput
        || (!animation?.settled && zoomShift(userInput.origin, next) < Math.log(1.25)));
      if (!userInput && (!complete || (animation && !matchesTarget))) {
        if (!complete && animation && !animation.settled) lastNativeRegion = next;
        return;
      }

      lastNativeRegion = next;
      if (animation && complete) {
        if (atProgrammaticTarget) animation.settled = true;
        else if (userInput) animation = undefined;
      }

      visible = next;
      if (atProgrammaticTarget && userInput && complete) userInput.origin = next;
      return { userMoved: Boolean(complete && userInput && !atProgrammaticTarget && hasMeaningfulMapChange(userInput.origin, next)) };
    },
  };
}
