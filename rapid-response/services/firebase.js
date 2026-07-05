import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAtK2lFYr8WG_HLEhj8P4xhJ6ZzAajkq0c",
  authDomain: "rapid-crisis-response-31d80.firebaseapp.com",
  projectId: "rapid-crisis-response-31d80",
  storageBucket: "rapid-crisis-response-31d80.firebasestorage.app",
  messagingSenderId: "165116134692",
  appId: "1:165116134692:web:5e6aa4ec6bf8193ac51fb1",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
