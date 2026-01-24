/**
 * Offline Banner Component
 *
 * Displays a banner when the device is offline.
 */

import { Ionicons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { useNetworkStatus } from "@/lib/offline";

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();

  if (isConnected) {
    return null;
  }

  return (
    <View className="bg-destructive/90 px-4 py-2">
      <View className="flex-row items-center justify-center gap-2">
        <Ionicons color="#FFFFFF" name="cloud-offline-outline" size={16} />
        <Text className="font-semibold text-sm text-white">
          No internet connection
        </Text>
      </View>
    </View>
  );
}
