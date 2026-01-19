import { Platform } from "react-native";

if (Platform.OS !== "web") {
  // Ensure global RTCPeerConnection/etc are available for libraries relying on globals.
  // This is a no-op if react-native-webrtc isn't linked (e.g., Expo Go).
  import("react-native-webrtc")
    .then((mod) => {
      if (typeof mod.registerGlobals === "function") {
        mod.registerGlobals();
      }
    })
    .catch(() => {});
}

import "expo-router/entry";
