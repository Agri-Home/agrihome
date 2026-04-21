export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
}

export interface AuthenticatedUser {
  uid: string;
  email: string | null;
  name: string | null;
  picture: string | null;
}
