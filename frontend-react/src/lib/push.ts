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

/** A refused browser has no Firebase id to hand over, so it gets a key of ours,
 *  kept in storage so every reload reports the same one. */
function deviceKey() {
  let key = localStorage.getItem(DEVICE_KEY);

  if (!key) {
    key = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, key);
  }

  return key;
}

/** A deployment with no Firebase keys still runs; it just never registers a browser,
 *  which is also what leaves the challenge email as the only channel there. */
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

  /** Must be called from a click: Safari refuses a permission ask with no gesture. */
  async requestPermission() {
    if (Notification.permission === "denied") return this.reportDenied();
    if (!this.configured) return false;

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return this.reportDenied();

    return this.register();
  }

  /** For a browser that already said yes, including one whose installation has rotated. */
  async sync() {
    // A refusal is worth reporting even where Firebase is not configured at all.
    if (Notification.permission === "denied") return this.reportDenied();
    if (!this.configured || Notification.permission !== "granted") return false;

    return this.register();
  }

  /** The server holds on to this: a refusal also settles whether it may email them. */
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

    // The worker is served with the config in its query string because a static file
    // has no access to the bundle's env, and it needs it to initialize Firebase itself.
    const serviceWorkerRegistration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${new URLSearchParams(config as Record<string, string>)}`,
      // The worker script is otherwise cached for a day, which leaves a browser running
      // the copy it first saw long after the file on disk changed.
      { scope: "/", updateViaCache: "none" },
    );

    this.worker = serviceWorkerRegistration;

    if (!this.listening) {
      this.listening = true;

      // A hidden tab still holds the socket, so the message arrives here rather than
      // at the worker and the in-app toast is drawn where nobody is looking. Putting
      // it back through the worker is also what gives it the click handler that opens
      // the challenge; a visible tab keeps the toast it can actually see.
      onMessage(messaging, (payload) => {
        if (document.visibilityState !== "hidden") return;

        // Console test sends arrive under `notification`, the server's under `data`.
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

