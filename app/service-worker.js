// Register event listener for the ‘push’ event.
self.addEventListener('push', function (event) {
    const payload = event.data.json();
    // Keep the service worker alive until the notification is created.
    event.waitUntil(
        // Show a notification with title ‘ServiceWorker Cookbook’ and body ‘Alea iacta est’.
        self.registration.showNotification(payload.title, {
            body: payload.body,
        })
    );
});