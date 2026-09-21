import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import pushInstallationService from "../push-installation/push-installation.service";

export interface PushMessage {
  title: string;
  body: string;
  url: string;
}

const DEAD_INSTALLATION_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];

// Data-only on purpose: the service worker decides what to show, which is the only
// way it can suppress a notification for a tab the user is already looking at.
class PushService {
  private app: App | null | undefined;

  /** Absent service-account env leaves this null, and every send quietly does nothing. */
  private client() {
    if (this.app === undefined) {
      const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
      this.app = raw
        ? (getApps()[0] ?? initializeApp({ credential: cert(JSON.parse(raw)) }))
        : null;
    }

    return this.app;
  }

  /** False when the user has no registered browser, which is the signal to fall back to email. */
  async sendToUser(userId: string, message: PushMessage) {
    const client = this.client();
    if (!client) return false;

    const fids = await pushInstallationService.installationsFor(userId);
    if (!fids.length) return false;

    const response = await getMessaging(client).sendEachForMulticast({
      fids,
      data: { title: message.title, body: message.body, url: message.url },
      webpush: { headers: { Urgency: "high" } },
    });

    await pushInstallationService.forget(
      response.responses.flatMap((result, index) =>
        result.error && DEAD_INSTALLATION_CODES.includes(result.error.code)
          ? [fids[index]]
          : [],
      ),
    );

    return true;
  }
}

const pushService = new PushService();

export default pushService;
