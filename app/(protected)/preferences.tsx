import { useAuth } from "@/context/auth-context";
import FacilityPreferencesPage from "../../components/staff-portal/preferences/facility-preferences-page";
import PreferencesPage from "../../components/staff-portal/preferences/preferences-page";

export default function PreferencesScreen() {
  const { isAdmin } = useAuth();

  if (isAdmin) {
    return <FacilityPreferencesPage />;
  }

  return <PreferencesPage />;
}
