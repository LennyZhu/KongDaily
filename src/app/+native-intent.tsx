import type { NativeIntent } from 'expo-router';

const maxNativeLinkLength = 8_192;

export const redirectSystemPath: NonNullable<NativeIntent['redirectSystemPath']> = ({ path }) => {
  if (path.length > maxNativeLinkLength) return null;
  try {
    // Validate the encoding without decoding the string passed to Expo Router.
    decodeURI(path);
    return path;
  } catch {
    return null;
  }
};
