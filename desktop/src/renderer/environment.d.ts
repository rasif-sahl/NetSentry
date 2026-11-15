interface Window {
  netsentry?: {
    getRuntimeInfo(): { platform: string; electronVersion: string };
  };
}
