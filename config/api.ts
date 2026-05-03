import type axiosType from "axios";
import Constants from "expo-constants";
import { Platform } from "react-native";

const axios = require("axios/dist/browser/axios.cjs") as typeof axiosType;

const PROD_API_BASE = "https://easishift-be-1df7f9547644.herokuapp.com";
const DEFAULT_DEV_WEB_BASE = "http://localhost:5000";
const DEFAULT_DEV_DEVICE_BASE = "http://10.0.2.2:5000";

function getExpoHost() {
  const hostUri =
    Constants.expoConfig?.hostUri ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost ||
    Constants.manifest?.debuggerHost;

  if (!hostUri || typeof hostUri !== "string") {
    return null;
  }

  return hostUri.split(":")[0] || null;
}

function getDevApiBase() {
  if (Platform.OS === "web") {
    return DEFAULT_DEV_WEB_BASE;
  }

  // Android emulator cannot reach host localhost directly.
  if (Platform.OS === "android") {
    return DEFAULT_DEV_DEVICE_BASE;
  }

  // For iOS simulator / physical device in Expo Go, use the machine host.
  const expoHost = getExpoHost();
  if (expoHost) {
    return `http://${expoHost}:5000`;
  }

  return DEFAULT_DEV_WEB_BASE;
}

const envApiBase = process.env.EXPO_PUBLIC_API_BASE?.trim();

export const API_BASE =
  envApiBase || (__DEV__ ? getDevApiBase() : PROD_API_BASE);

const api = axios.create({
  baseURL: `${API_BASE}/api/v1`,
  withCredentials: true,
});

export default api;
