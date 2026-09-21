import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  isSupported,
  onMessage,
  onRegistered,
  onUnregistered,
  register as registerMessaging,
} from "firebase/messaging";
import { api } from "./api";

const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;

const DEVICE_KEY = "push-device-key";

function deviceKey() {
  let key = localStorage.getItem(DEVICE_KEY);

  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, key);
  }

  return key;
}

class PushService {
  private app: FirebaseApp | null = null;
  private worker: ServiceWorkerRegistration | null = null;
  private listening = false;

  get configured() {
    return Boolean(
      config.apiKey &&
      config.projectId &&
      config.messagingSenderId &&
      config.appId &&
      vapidKey,
    );
  }

  async requestPermission() {
    if (Notification.permission === "denied") return this.reportDenied();
    if (!this.configured) return false;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return this.reportDenied();

    return this.register();
  }

  async sync() {
    if (Notification.permission === "denied") return this.reportDenied();
    if (!this.configured || Notification.permission !== "granted") return false;

    return this.register();
  }

  private async reportDenied() {
    await api
      .post("/notifications/devices", {
        installationId: deviceKey(),
        status: "Denied",
      })
      .catch((error) => console.error(error));

    return false;
  }

  private async register() {
    if (!(await isSupported())) return false;

    this.app ??= initializeApp(config);
    const messaging = getMessaging(this.app);

    const serviceWorkerRegistration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${new URLSearchParams(config as Record<string, string>)}`,
      { scope: "/", updateViaCache: "none" },
    );

    this.worker = serviceWorkerRegistration;

    if (!this.listening) {
      this.listening = true;

      onMessage(messaging, (payload) => {
        if (document.visibilityState !== "hidden") return;

        const title = payload.data?.title || payload.notification?.title;

        this.worker?.showNotification(title || "Arkos Games", {
          body: payload.data?.body || payload.notification?.body || "",
          icon: "/android-chrome-192x192.png",
          badge: "/favicon-32x32.png",
          data: { url: payload.data?.url || "/" },
        });
      });

      onRegistered(messaging, (installationId) => {
        api
          .post("/notifications/devices", { installationId })
          .catch((error) => console.error(error));
      });

      onUnregistered(messaging, (installationId) => {
        api
          .delete("/notifications/devices", { installationId })
          .catch((error) => console.error(error));
      });
    }

    await registerMessaging(messaging, {
      vapidKey,
      serviceWorkerRegistration,
    });

    return true;
  }
}

const pushService = new PushService();

export default pushService;

