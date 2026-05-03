import Paywall from "@/components/staff-portal/dashboard/paywall";
import { useAuth } from "@/context/auth-context";

export default function PaywallScreen() {
  const { tenant } = useAuth();
  return <Paywall tenant={tenant} />;
}
