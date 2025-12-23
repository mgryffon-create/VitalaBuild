// Push Notification Utilities for VitalaMatch

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY || '';

// Convert URL-safe base64 to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if push notifications are supported
export function isPushNotificationSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

// Get current notification permission status
export function getNotificationPermission() {
  if (!isPushNotificationSupported()) {
    return 'unsupported';
  }
  return Notification.permission; // 'default', 'granted', 'denied'
}

// Request notification permission
export async function requestNotificationPermission() {
  if (!isPushNotificationSupported()) {
    console.warn('Push notifications not supported');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return false;
  }
}

// Register service worker
export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/'
    });
    
    console.log('Service worker registered:', registration.scope);
    
    // Wait for the service worker to be ready
    await navigator.serviceWorker.ready;
    
    return registration;
  } catch (error) {
    console.error('Service worker registration failed:', error);
    return null;
  }
}

// Subscribe to push notifications
export async function subscribeToPushNotifications(registration) {
  if (!registration) {
    console.warn('No service worker registration');
    return null;
  }

  try {
    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('Already subscribed to push notifications');
      return subscription;
    }

    // Subscribe with VAPID key if available
    const options = {
      userVisibleOnly: true
    };

    if (VAPID_PUBLIC_KEY) {
      options.applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    }

    subscription = await registration.pushManager.subscribe(options);
    console.log('Push notification subscription:', subscription);
    
    return subscription;
  } catch (error) {
    console.error('Failed to subscribe to push notifications:', error);
    return null;
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      console.log('Unsubscribed from push notifications');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to unsubscribe:', error);
    return false;
  }
}

// Show a local notification (for testing or non-push notifications)
export function showLocalNotification(title, options = {}) {
  if (!isPushNotificationSupported() || Notification.permission !== 'granted') {
    console.warn('Cannot show notification - permission not granted');
    return null;
  }

  const defaultOptions = {
    icon: '/images/vitalamatch-icon.png',
    badge: '/images/vitalamatch-icon.png',
    vibrate: [100, 50, 100],
    tag: 'vitalamatch-local',
    requireInteraction: false
  };

  return new Notification(title, { ...defaultOptions, ...options });
}

// Get push subscription info to send to server
export async function getPushSubscription() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      return {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('p256dh')))),
          auth: btoa(String.fromCharCode.apply(null, new Uint8Array(subscription.getKey('auth'))))
        }
      };
    }
    return null;
  } catch (error) {
    console.error('Failed to get push subscription:', error);
    return null;
  }
}

// Initialize PWA features
export async function initializePWA() {
  console.log('Initializing PWA features...');
  
  // Register service worker
  const registration = await registerServiceWorker();
  
  if (!registration) {
    console.warn('PWA initialization incomplete - no service worker');
    return { registration: null, subscription: null };
  }

  // Check and potentially request notification permission
  const permission = getNotificationPermission();
  console.log('Notification permission:', permission);

  let subscription = null;
  if (permission === 'granted') {
    subscription = await subscribeToPushNotifications(registration);
  }

  return { registration, subscription };
}

export default {
  isPushNotificationSupported,
  getNotificationPermission,
  requestNotificationPermission,
  registerServiceWorker,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  showLocalNotification,
  getPushSubscription,
  initializePWA
};
