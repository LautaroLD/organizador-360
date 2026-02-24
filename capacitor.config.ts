import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.veenzo.app',
  appName: 'veenzo',
  webDir: 'public',
  server: {
    url: 'https://veenzo.app',
    cleartext: false,
  },
};

export default config;
