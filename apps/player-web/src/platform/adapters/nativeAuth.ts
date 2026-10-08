/**
 * Native Google and Apple sign-in (T10.3). Popups don't work inside the app shell,
 * so the native sheet gets a credential (skipNativeAuth: the web SDK stays the one
 * source of truth) and we sign in, or link, with it through the web Firebase SDK.
 * The backend sees exactly the same ID tokens as on the web.
 * Loaded only inside the iOS/Android shell (dynamic import from lib/firebase.ts).
 */
import { FirebaseAuthentication } from "@capacitor-firebase/authentication";
import {
  GoogleAuthProvider,
  OAuthProvider,
  linkWithCredential,
  signInWithCredential,
  type Auth,
  type AuthCredential,
  type User,
  type UserCredential,
} from "firebase/auth";

export type NativeProvider = "google" | "apple";

async function credentialFor(provider: NativeProvider): Promise<AuthCredential> {
  if (provider === "google") {
    const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
    const idToken = result.credential?.idToken;
    if (!idToken) throw new Error("google_sign_in_cancelled");
    return GoogleAuthProvider.credential(idToken, result.credential?.accessToken);
  }
  const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
  const idToken = result.credential?.idToken;
  if (!idToken) throw new Error("apple_sign_in_cancelled");
  return new OAuthProvider("apple.com").credential({
    idToken,
    rawNonce: result.credential?.nonce,
  });
}

export async function nativeSignIn(auth: Auth, provider: NativeProvider): Promise<UserCredential> {
  return signInWithCredential(auth, await credentialFor(provider));
}

export async function nativeLink(user: User, provider: NativeProvider): Promise<UserCredential> {
  return linkWithCredential(user, await credentialFor(provider));
}
