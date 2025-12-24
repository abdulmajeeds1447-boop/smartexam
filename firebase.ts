import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeFirestore, 
  memoryLocalCache,
  getFirestore
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAkAvNzeQFOLltzTStkXFOfY06FXHSh8r4",
  authDomain: "smartexam-88ca5.firebaseapp.com",
  projectId: "smartexam-88ca5",
  storageBucket: "smartexam-88ca5.firebasestorage.app",
  messagingSenderId: "287974080178",
  appId: "1:287974080178:web:e4c66aa8c251dd518293ab"
};

// Singleton pattern to prevent re-initialization errors during HMR
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

let db;

try {
  // We use memoryLocalCache to avoid IndexedDB errors in restrictive environments.
  // We use experimentalForceLongPolling to avoid WebSocket timeouts (10s error).
  // This must be called BEFORE any other getFirestore call on this app instance.
  db = initializeFirestore(app, {
    localCache: memoryLocalCache(),
    experimentalForceLongPolling: true,
  });
} catch (error: any) {
  // If Firestore is already initialized (e.g. during Hot Module Reloading), 
  // initializeFirestore will throw a 'failed-precondition' error.
  // In that case, we retrieve the existing instance.
  if (error.code === 'failed-precondition' || error.message?.includes('already been initialized')) {
    db = getFirestore(app);
    // Note: If the existing instance was initialized without long polling (e.g. first load), 
    // it might still fail. A full page refresh is recommended if connection errors persist.
    console.warn("Firestore already initialized. Using existing instance.");
  } else {
    // Log string message only to avoid circular structure errors
    console.error("Firestore initialization failed:", error.message || String(error));
    // Fallback
    db = getFirestore(app);
  }
}

export { db };