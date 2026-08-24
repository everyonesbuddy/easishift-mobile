import CoveragePlanningPage from "@/components/staff-portal/coverage/coverage-planning-page";
import { useAuth } from "@/context/auth-context";
import { Redirect } from "expo-router";

export default function CoveragePlanningScreen() {
  const { can } = useAuth();

  if (!can("coverage.view") && !can("coverage.manage")) {
    return <Redirect href="/dashboard" />;
  }

  return <CoveragePlanningPage />;
}
