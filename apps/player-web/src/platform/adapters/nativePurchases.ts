/**
 * The family supporter purchase inside the store apps (T12.3), through RevenueCat.
 * Loaded only inside the iOS/Android shell. RevenueCat tells our server (webhook),
 * which records the supporter; the app just refreshes its supporter status after.
 * Callers must ask a grown-up first (requestGrownUp) — the Kids category requires it.
 */
import { Capacitor } from "@capacitor/core";
import { Purchases } from "@revenuecat/purchases-capacitor";
import brand from "../../config/brand.json";

export const SUPPORTER_PRODUCT = "family_supporter";

let configuredFor: string | null = null;

async function configure(appUserId: string): Promise<boolean> {
  const apiKey =
    Capacitor.getPlatform() === "android" ? brand.revenueCatGoogleKey : brand.revenueCatAppleKey;
  if (!apiKey) return false;
  if (configuredFor !== appUserId) {
    await Purchases.configure({ apiKey, appUserID: appUserId });
    configuredFor = appUserId;
  }
  return true;
}

export type PurchaseOutcome = "purchased" | "cancelled" | "unavailable" | "failed";

export async function buySupporter(appUserId: string): Promise<PurchaseOutcome> {
  try {
    if (!(await configure(appUserId))) return "unavailable";
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (p) => p.product.identifier === SUPPORTER_PRODUCT,
    );
    if (!pkg) return "unavailable";
    await Purchases.purchasePackage({ aPackage: pkg });
    return "purchased";
  } catch (err) {
    const cancelled = (err as { userCancelled?: boolean }).userCancelled === true;
    return cancelled ? "cancelled" : "failed";
  }
}

/** "Restore purchases" (required by Apple): RevenueCat re-sends the purchase to our webhook. */
export async function restorePurchases(appUserId: string): Promise<boolean> {
  try {
    if (!(await configure(appUserId))) return false;
    const { customerInfo } = await Purchases.restorePurchases();
    return Object.keys(customerInfo.entitlements.active).length > 0;
  } catch {
    return false;
  }
}
