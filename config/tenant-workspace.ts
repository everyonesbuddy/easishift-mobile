import { Platform } from "react-native";

export const TENANT_ROOT_DOMAIN = String(
  process.env.EXPO_PUBLIC_TENANT_ROOT_DOMAIN || "wisershifts.com",
)
  .trim()
  .toLowerCase()
  .replace(/^\.+|\.+$/g, "");

const currentHostname = () =>
  Platform.OS === "web" && typeof window !== "undefined"
    ? window.location.hostname
    : "";

export const isLocalWorkspaceHost = (hostname = currentHostname()) =>
  ["localhost", "127.0.0.1"].includes(String(hostname || "").toLowerCase());

export const getWorkspaceDomainLabel = (hostname = currentHostname()) =>
  isLocalWorkspaceHost(hostname) ? "localhost" : TENANT_ROOT_DOMAIN;

export const isRootWorkspaceHost = (hostname = currentHostname()) => {
  const host = String(hostname || "").toLowerCase();
  return (
    isLocalWorkspaceHost(host) ||
    host === TENANT_ROOT_DOMAIN ||
    host === `www.${TENANT_ROOT_DOMAIN}`
  );
};

export const getTenantSubdomain = (hostname = currentHostname()) => {
  if (!hostname && Platform.OS !== "web") {
    return (
      process.env.EXPO_PUBLIC_TENANT_SUBDOMAIN?.trim().toLowerCase() || null
    );
  }

  const host = String(hostname || "")
    .trim()
    .toLowerCase()
    .replace(/\.$/, "");
  if (isRootWorkspaceHost(host)) return null;

  const suffix = host.endsWith(".localhost")
    ? ".localhost"
    : `.${TENANT_ROOT_DOMAIN}`;
  if (!host.endsWith(suffix)) return null;

  const subdomain = host.slice(0, -suffix.length);
  return subdomain && !subdomain.includes(".") && subdomain !== "www"
    ? subdomain
    : null;
};

export const isTenantWorkspaceHost = (hostname = currentHostname()) =>
  Boolean(getTenantSubdomain(hostname));

export const getTenantLoginUrl = (subdomain: string) => {
  if (isLocalWorkspaceHost()) {
    const port = window.location.port ? `:${window.location.port}` : "";
    return `http://${subdomain}.localhost${port}/login`;
  }
  return `https://${subdomain}.${TENANT_ROOT_DOMAIN}/login`;
};
