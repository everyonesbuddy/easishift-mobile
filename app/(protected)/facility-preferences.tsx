import { Redirect } from "expo-router";

import FacilityPreferencesPage from "@/components/staff-portal/preferences/facility-preferences-page";
import { useAuth } from "@/context/auth-context";

export default function FacilityPreferencesScreen() {
  const { can } = useAuth();

  if (
    !can("facility_preferences.view") &&
    !can("facility_preferences.manage")
  ) {
    return <Redirect href="/preferences" />;
  }

  return <FacilityPreferencesPage />;
}
