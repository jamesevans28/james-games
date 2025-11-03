declare module "virtual:pwa-register/react" {
  export function useRegisterSW(options?: {
    immediate?: boolean;
    onRegisteredSW?: (swScriptUrl?: string, registration?: ServiceWorkerRegistration) => void;
    onRegisterError?: (error: unknown) => void;
  }): {
    needRefresh: boolean;
    offlineReady: boolean;
    updateServiceWorker: (reloadPage?: boolean) => Promise<void> | void;
  };
}
