importScripts("https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js");
importScripts(
  "https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js",
);

const params = new URL(self.location).searchParams;

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

/** Whether a tab is on screen, which is the only thing that decides if this shows. */
async function visibleClient() {
  const clients = await self.clients.matchAll({
    type: "window",
    includeUncontrolled: true,
  });

  return clients.some((client) => client.visibilityState === "visible");
}

// A page that is on screen draws its own toast, so a notification here would be the
// same news twice; it is only ever wanted when nobody is looking.
firebase.messaging().onBackgroundMessage(async (payload) => {
  if (await visibleClient()) return;

  // A message sent from the Firebase console carries `notification`, ours carries
  // `data`. Reading both is what keeps a test send from arriving as "undefined".
  const message = payload.data || payload.notification || {};

  self.registration.showNotification(
    typeof message.title === "string" && message.title ? message.title : "Arkos Games",
    {
      body: typeof message.body === "string" ? message.body : "",
      icon: "/android-chrome-192x192.png",
      badge: "/favicon-32x32.png",
      data: { url: message.url || "/" },
    },
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = (event.notification.data || {}).url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const open = clients.find((client) =>
          client.url.startsWith(self.location.origin),
        );

        return open ? open.focus().then(() => open.navigate(url)) : self.clients.openWindow(url);
      }),
  );
});
