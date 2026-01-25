import type { ConfigPlugin } from "@expo/config-plugins";

import { withEntitlementsPlist } from "@expo/config-plugins";

interface CarPlayConfig {
  enabled?: boolean;
}

const withCarPlay: ConfigPlugin<CarPlayConfig> = (config, props) => {
  if (!props?.enabled) {
    return config;
  }
  return withEntitlementsPlist(config, (innerConfig) => {
    const entitlements = innerConfig.modResults ?? {};
    entitlements["com.apple.developer.carplay-audio"] = true;
    innerConfig.modResults = entitlements;
    return innerConfig;
  });
};

export default withCarPlay;
