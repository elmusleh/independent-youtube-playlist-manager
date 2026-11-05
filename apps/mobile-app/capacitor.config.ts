import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.elmusleh.iypm",
  appName: "IYPM",
  webDir: "../../apps/browser-extension/playlist-manager/editor",
  bundledWebRuntime: false,
  server: {
    androidScheme: "https",
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: "#065fd4",
      showSpinner: false,
    },
    CapacitorHttp: {
      enabled: true,
    },
  },
};

export default config;
