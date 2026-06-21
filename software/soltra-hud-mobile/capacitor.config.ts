import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.soltra.hud',
  appName: 'soltra-hud',
  webDir: 'build',
  server: {
    cleartext: true
  },
  android: {
    overrideUserAgent: "soltra-hud-app-client"
  }
};

export default config;
