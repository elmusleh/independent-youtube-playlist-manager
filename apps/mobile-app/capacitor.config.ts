import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.elmusleh.iypm",
  appName: "IYPM",
  webDir: "../../dist/chrome/editor",
  plugins: {
    SecureStorage: {
      // Custom plugin registered in MainActivity
    },
  },
};

export default config;
