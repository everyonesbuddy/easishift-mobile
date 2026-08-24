import { getFacilityRolesFromUser } from "@/constants/industry-roles";
import { useAuth } from "@/context/auth-context";
import { Redirect } from "expo-router";
import PreferencesPage from "../../components/staff-portal/preferences/preferences-page";

export default function PreferencesScreen() {
  const { user, facilityPreferences } = useAuth();

  if (!getFacilityRolesFromUser(user, facilityPreferences).length) {
    return <Redirect href="/dashboard" />;
  }

  return <PreferencesPage />;
}
