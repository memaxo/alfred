// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require("expo/metro-config");
const { FileStore } = require("metro-cache");
const { withNativeWind } = require("nativewind/metro");
const path = require("node:path");
const resolveFrom = require("resolve-from");

const config = withTurborepoManagedCache(
  withNativeWind(getDefaultConfig(__dirname), {
    input: "./global.css",
    configPath: "./tailwind.config.js",
  })
);

// Ensure TypeScript files from node_modules are handled properly
config.resolver.sourceExts.push("ts", "tsx");

// Ensure `event-target-shim/index` resolves to a concrete file path.
// `react-native-webrtc` imports `event-target-shim/index`, but `event-target-shim@6`
// does not export the `./index` subpath. Metro's resolver needs a direct file path.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "event-target-shim/index" ||
    moduleName === "event-target-shim/index.js" ||
    moduleName === "event-target-shim/index.mjs"
  ) {
    const pkgJson = resolveFrom(
      context.originModulePath,
      "event-target-shim/package.json"
    );
    const root = path.dirname(pkgJson);
    return { filePath: path.join(root, "index.js"), type: "sourceFile" };
  }

  return context.resolveRequest(context, moduleName, platform);
};

// Temporarily disable package exports to avoid Node.js trying to resolve .ts files
// Metro will still handle the resolution correctly for runtime bundles
// Re-enable once expo-modules-core and other packages provide proper .js exports.
// config.resolver.unstable_enablePackageExports = true;

module.exports = config;

/**
 * Move the Metro cache to the `.cache/metro` folder.
 * If you have any environment variables, you can configure Turborepo to invalidate it when needed.
 *
 * @see https://turbo.build/repo/docs/reference/configuration#env
 * @param {import('expo/metro-config').MetroConfig} config
 * @returns {import('expo/metro-config').MetroConfig}
 */
function withTurborepoManagedCache(config) {
  config.cacheStores = [
    new FileStore({ root: path.join(__dirname, ".cache/metro") }),
  ];
  return config;
}
