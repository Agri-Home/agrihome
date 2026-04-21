import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import { env, hasFirebaseAdminConfig } from "@/lib/config/env";

const getAdminCredential = () => {
  const serviceAccountJson = env.firebase.admin.serviceAccountJson;

  if (serviceAccountJson) {
    try {
      return cert(JSON.parse(serviceAccountJson));
    } catch (error) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON is invalid: ${
          error instanceof Error ? error.message : "could not parse JSON"
        }`
      );
    }
  }

  if (env.firebase.admin.clientEmail && env.firebase.admin.privateKey) {
    return cert({
      projectId: env.firebase.projectId || undefined,
      clientEmail: env.firebase.admin.clientEmail,
      privateKey: env.firebase.admin.privateKey
    });
  }

  return applicationDefault();
};

const getFirebaseAdminApp = () => {
  if (!hasFirebaseAdminConfig) {
    throw new Error(
      "Firebase Admin credentials are missing. Set FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY, or FIREBASE_SERVICE_ACCOUNT_JSON."
    );
  }

  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  return initializeApp({
    credential: getAdminCredential(),
    projectId: env.firebase.projectId || undefined
  });
};

export const getFirebaseAdminAuth = () => getAuth(getFirebaseAdminApp());
