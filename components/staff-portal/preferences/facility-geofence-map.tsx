import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import MapView, { Circle, MapPressEvent, Marker } from "react-native-maps";

export type FacilityGeofence = {
  address?: string;
  latitude?: number | null;
  longitude?: number | null;
  radiusMeters?: number;
};

type SearchResult = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
};

type Props = {
  geofence?: FacilityGeofence;
  onChange: <K extends keyof FacilityGeofence>(
    field: K,
    value: FacilityGeofence[K],
  ) => void;
  disabled?: boolean;
};

function getCoordinates(geofence?: FacilityGeofence) {
  const latitude = Number(geofence?.latitude);
  const longitude = Number(geofence?.longitude);

  if (
    geofence?.latitude === null ||
    geofence?.latitude === undefined ||
    geofence?.longitude === null ||
    geofence?.longitude === undefined ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

export default function FacilityGeofenceMap({
  geofence,
  onChange,
  disabled = false,
}: Props) {
  const [query, setQuery] = useState(geofence?.address || "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState("");
  const position = getCoordinates(geofence);
  const radius = Math.max(25, Number(geofence?.radiusMeters) || 150);

  const selectPosition = (
    latitude: number | string,
    longitude: number | string,
    address = query.trim(),
  ) => {
    if (address) onChange("address", address);
    onChange("latitude", Number(latitude));
    onChange("longitude", Number(longitude));
  };

  const searchAddress = async () => {
    const search = query.trim();
    if (!search) return;

    setSearching(true);
    setMessage("");
    setResults([]);

    try {
      const params = new URLSearchParams({
        q: search,
        format: "jsonv2",
        limit: "5",
      });
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?${params.toString()}`,
        { headers: { Accept: "application/json" } },
      );
      if (!response.ok) throw new Error("Address search is unavailable.");

      const matches = (await response.json()) as SearchResult[];
      setResults(Array.isArray(matches) ? matches : []);
      if (!matches.length) setMessage("No matching addresses found.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Address search failed. Try again.",
      );
    } finally {
      setSearching(false);
    }
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    setMessage("");

    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        throw new Error("Location permission is required to use this device.");
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      selectPosition(location.coords.latitude, location.coords.longitude);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to get location.",
      );
    } finally {
      setLocating(false);
    }
  };

  const selectResult = (result: SearchResult) => {
    const address = result.display_name || query.trim();
    selectPosition(result.lat, result.lon, address);
    setQuery(address);
    setResults([]);
  };

  const handleMapPress = (event: MapPressEvent) => {
    if (disabled) return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    selectPosition(latitude, longitude, geofence?.address || query.trim());
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search facility address"
          editable={!disabled && !searching}
          returnKeyType="search"
          onSubmitEditing={searchAddress}
          style={styles.input}
        />
        <Pressable
          style={[styles.iconButton, disabled ? styles.disabled : null]}
          onPress={searchAddress}
          disabled={disabled || searching || !query.trim()}
          accessibilityLabel="Search facility address"
        >
          {searching ? (
            <ActivityIndicator size="small" color="#1d4ed8" />
          ) : (
            <Feather name="search" size={17} color="#1d4ed8" />
          )}
        </Pressable>
        <Pressable
          style={[styles.iconButton, disabled ? styles.disabled : null]}
          onPress={useCurrentLocation}
          disabled={disabled || locating}
          accessibilityLabel="Use current device location"
        >
          {locating ? (
            <ActivityIndicator size="small" color="#1d4ed8" />
          ) : (
            <Feather name="crosshair" size={17} color="#1d4ed8" />
          )}
        </Pressable>
      </View>

      {results.length ? (
        <View style={styles.results}>
          {results.map((result) => (
            <Pressable
              key={String(result.place_id)}
              style={styles.result}
              onPress={() => selectResult(result)}
              disabled={disabled}
            >
              <Text style={styles.resultText}>{result.display_name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      <View style={styles.mapFrame}>
        <MapView
          style={styles.map}
          region={{
            latitude: position?.latitude ?? 20,
            longitude: position?.longitude ?? 0,
            latitudeDelta: position ? 0.01 : 100,
            longitudeDelta: position ? 0.01 : 100,
          }}
          onPress={handleMapPress}
        >
          {position ? (
            <>
              <Marker
                coordinate={position}
                draggable={!disabled}
                onDragEnd={(event) => {
                  const { latitude, longitude } = event.nativeEvent.coordinate;
                  selectPosition(
                    latitude,
                    longitude,
                    geofence?.address || query.trim(),
                  );
                }}
              />
              <Circle
                center={position}
                radius={radius}
                strokeColor="#1565c0"
                fillColor="rgba(21, 101, 192, 0.12)"
              />
            </>
          ) : null}
        </MapView>
      </View>

      <View style={styles.radiusRow}>
        <Text style={styles.radiusLabel}>Allowed radius (meters)</Text>
        <TextInput
          value={String(radius)}
          onChangeText={(value) => {
            const next = Number(value.replace(/[^0-9]/g, ""));
            onChange("radiusMeters", Number.isFinite(next) ? next : 150);
          }}
          editable={!disabled}
          keyboardType="number-pad"
          style={styles.radiusInput}
        />
      </View>

      <Text style={styles.hint}>
        Select an address, then tap the map or drag the pin to confirm the
        facility center. The circle previews the allowed radius.
      </Text>
      {!position ? (
        <Text style={styles.warning}>
          Select the facility location before saving geofence mode.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 9 },
  searchRow: { flexDirection: "row", gap: 7 },
  input: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#111827",
    backgroundColor: "#ffffff",
  },
  iconButton: {
    width: 40,
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: { opacity: 0.5 },
  results: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    overflow: "hidden",
  },
  result: {
    paddingHorizontal: 10,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#d1d5db",
  },
  resultText: { color: "#334155", fontSize: 12, lineHeight: 17 },
  message: { color: "#1e40af", fontSize: 12 },
  mapFrame: {
    height: 300,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    overflow: "hidden",
  },
  map: { width: "100%", height: "100%" },
  radiusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  radiusLabel: { flex: 1, color: "#334155", fontSize: 12, fontWeight: "600" },
  radiusInput: {
    width: 90,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    color: "#111827",
    textAlign: "right",
    backgroundColor: "#ffffff",
  },
  hint: { color: "#64748b", fontSize: 11, lineHeight: 16 },
  warning: {
    color: "#92400e",
    backgroundColor: "#fef3c7",
    borderColor: "#fcd34d",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 12,
  },
});
