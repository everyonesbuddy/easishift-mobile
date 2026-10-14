import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * A staff member's personal link lives on the phone so they don't have to
 * tap the text every time. The link token is a credential, so it goes in
 * the Keychain / Keystore (AsyncStorage on web, where SecureStore is
 * unavailable).
 */

const LINK_KEY = "wisershifts_staff_link";
const deviceKey = (token: string) => `wisershifts_device_${token.slice(0, 16)}`;

async function getItem(key: string) {
  try {
    if (Platform.OS === "web") return await AsyncStorage.getItem(key);
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function setItem(key: string, value: string | null) {
  try {
    if (Platform.OS === "web") {
      if (value) await AsyncStorage.setItem(key, value);
      else await AsyncStorage.removeItem(key);
      return;
    }
    if (value) await SecureStore.setItemAsync(key, value);
    else await SecureStore.deleteItemAsync(key);
  } catch {
    // Storage unavailable: they'll just open their link again next time.
  }
}

export const readSavedLink = () => getItem(LINK_KEY);
export const saveLink = (token: string) => setItem(LINK_KEY, token);
export const forgetLink = () => setItem(LINK_KEY, null);

// This phone's PIN pass for a link (only when the facility requires a PIN).
export const readDeviceToken = (token: string) => getItem(deviceKey(token));
export const saveDeviceToken = (token: string, value: string | null) =>
  setItem(deviceKey(token), value);

/**
 * Accepts a full link ("https://wisershifts.com/s/abc…"), an app link
 * ("wiser-shifts-mobile://s/abc…") or just the token. Returns the token.
 */
export function parseLinkToken(input: string): string | null {
  const text = String(input || "").trim();
  if (!text) return null;
  const match = text.match(/\/s\/([A-Za-z0-9._~-]{16,})/);
  if (match) return match[1];
  if (/^[A-Za-z0-9._~-]{16,}$/.test(text)) return text;
  return null;
}
