import { Redirect } from "expo-router";

import TenantBrandingPage from "@/components/staff-portal/branding/tenant-branding-page";
import { useAuth } from "@/context/auth-context";

export default function TenantBrandingScreen() {
  const { can } = useAuth();

  if (!can("tenant.settings")) return <Redirect href="/dashboard" />;

  return <TenantBrandingPage />;
}
