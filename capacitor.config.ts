import type { CapacitorConfig } from '@capacitor/cli';

const isAppflowBuild = Boolean(process.env.IONIC_CLI_VERSION);
const remoteServerUrl = process.env.CAP_SERVER_URL?.trim() || 'https://veenzo.app';
const useRemoteServer = process.env.CAP_USE_REMOTE_SERVER === 'true' || isAppflowBuild;

const config: CapacitorConfig = {
  appId: 'com.veenzo.app',
  appName: 'veenzo',
  webDir: 'public',
  ...(useRemoteServer
    ? {
        server: {
          url: remoteServerUrl,
          cleartext: false,
        },
      }
    : {}),
};

export default config;
