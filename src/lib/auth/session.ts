import type { DecodedIdToken } from "firebase-admin/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { cache } from "react";

import { normalizeAccountEmail } from "@/lib/auth/account";
import { env, hasFirebaseAdminConfig } from "@/lib/config/env";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import type { AuthenticatedUser } from "@/lib/types/auth";

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 5;
const RECENT_SIGN_IN_WINDOW_SECONDS = 60 * 5;

const mapUser = (
  token: Pick<DecodedIdToken, "uid" | "email"> & {
    name?: string;
    picture?: string;
  }
): AuthenticatedUser => ({
  uid: token.uid,
  email: token.email ?? null,
  name: token.name ?? null,
  picture: token.picture ?? null
});

export const clearSessionCookie = (response: NextResponse) => {
  response.cookies.set(env.firebase.sessionCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: env.isProduction
  });

  return response;
};

export const createSessionResponse = async (idToken: string) => {
  if (!hasFirebaseAdminConfig) {
    throw new Error(
      "Firebase Admin is not configured. Add the admin service account variables before signing in."
    );
  }

  const adminAuth = getFirebaseAdminAuth();
  const decodedIdToken = await adminAuth.verifyIdToken(idToken);

  if (
    !decodedIdToken.auth_time ||
    Date.now() / 1000 - decodedIdToken.auth_time > RECENT_SIGN_IN_WINDOW_SECONDS
  ) {
    throw new Error("Please sign in again before starting a session.");
  }

  const sessionCookie = await adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS
  });

  const response = NextResponse.json({ data: mapUser(decodedIdToken) });

  response.cookies.set(env.firebase.sessionCookieName, sessionCookie, {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_MS / 1000,
    path: "/",
    sameSite: "lax",
    secure: env.isProduction
  });

  return response;
};

export const getSessionUser = cache(async () => {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(env.firebase.sessionCookieName)?.value;

  if (!sessionCookie || !hasFirebaseAdminConfig) {
    return null;
  }

  try {
    const decoded = await getFirebaseAdminAuth().verifySessionCookie(
      sessionCookie,
      true
    );

    return mapUser(decoded);
  } catch {
    return null;
  }
});

export const requireSessionUser = async () => {
  const user = await getSessionUser();

  if (!user) {
    redirect("/login");
  }

  return user;
};

export const requireSessionAccountUser = async () => {
  const user = await requireSessionUser();
  const email = normalizeAccountEmail(user.email);

  if (!email) {
    redirect("/login");
  }

  return {
    ...user,
    email
  };
};

export const requireApiUser = async () => {
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 }
    );
  }

  return user;
};

export const requireApiAccountUser = async () => {
  const user = await requireApiUser();

  if (user instanceof Response) {
    return user;
  }

  const email = normalizeAccountEmail(user.email);

  if (!email) {
    return NextResponse.json(
      { error: "Signed-in account must have an email address" },
      { status: 403 }
    );
  }

  return {
    ...user,
    email
  };
};
