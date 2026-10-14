import { Redirect, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { kit } from "@/components/ios/kit";
import { useStaffLink } from "@/context/staff-link-context";
import { parseLinkToken } from "@/services/staff-link/storage";

/**
 * A staff link opened on the phone (https://wisershifts.com/s/<token> as a
 * universal link, or wiser-shifts-mobile://s/<token>): keep it and open
 * their schedule.
 */
export default function OpenStaffLink() {
  const { token: raw } = useLocalSearchParams<{ token: string }>();
  const { openLink } = useStaffLink();
  const token = parseLinkToken(String(raw || ""));
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (token) openLink(token).then(() => setDone(true));
    // Only when the link itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (!token) return <Redirect href="/staff-start" />;
  if (done) return <Redirect href="/my" />;
  return (
    <View style={[kit.screen, { alignItems: "center", justifyContent: "center" }]}>
      <ActivityIndicator />
    </View>
  );
}
