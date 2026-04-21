"use client";

import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

import type { FirebaseClientConfig } from "@/lib/types/auth";

const CLIENT_APP_NAME = "agrihome-web";

export const hasFirebaseClientConfig = (config: FirebaseClientConfig) =>
  Boolean(
    config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.appId
  );

export const getFirebaseClientApp = (config: FirebaseClientConfig) => {
  if (!hasFirebaseClientConfig(config)) {
    throw new Error(
      "Firebase client config is incomplete. Set the FIREBASE_* web app variables."
    );
  }

  if (getApps().some((app) => app.name === CLIENT_APP_NAME)) {
    return getApp(CLIENT_APP_NAME);
  }

  return initializeApp(
    {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
      measurementId: config.measurementId || undefined
    },
    CLIENT_APP_NAME
  );
};

export const getFirebaseClientAuth = (config: FirebaseClientConfig) =>
  getAuth(getFirebaseClientApp(config));

export const createGoogleProvider = () => {
  const provider = new GoogleAuthProvider();

  provider.setCustomParameters({
    prompt: "select_account"
  });

  return provider;
};
