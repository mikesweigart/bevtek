"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

/**
 * BeforeInstallPromptEvent (Chromium) — not in lib.dom yet.
 * https://developer.mozilla.org/en-US/docs/Web/API/BeforeInstallPromptEvent
 */
type BeforeInstallPromptEvent = Event & {
  readonly platforms: string[];
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_STORAGE_PREFIX = "bevtek:install-dismissed:";

type EnvSnapshot = {
  isStandalone: boolean;
  isIOS: boolean;
  dismissed: boolean;
};

// SSR + first-render safe defaults: pretend everything is hidden so
// the markup matches between server and the very first client render.
// The post-hydration snapshot then reveals the real state.
function getServerSnapshot(): EnvSnapshot {
  return { isStandalone: true, isIOS: false, dismissed: true };
}

function envSnapshotFor(dismissKey: string) {
  return function getSnapshot(): EnvSnapshot {
    if (typeof window === "undefined") return getServerSnapshot();
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari sets navigator.standalone when launched from the
      // home screen. Cast through `unknown` because TS doesn't know.
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    const dismissed = !!window.localStorage.getItem(
      `${DISMISS_STORAGE_PREFIX}${dismissKey}`,
    );
    return { isStandalone, isIOS, dismissed };
  };
}

// We don't subscribe to anything live — standalone-mode and iOS-ness
// don't change mid-session. Returning a no-op unsubscribe is the
// documented way to use useSyncExternalStore for one-shot browser
// reads — the snapshot is captured at mount and stays stable.
function noopSubscribe() {
  return () => {};
}

/**
 * Generic "Install [appName] on your phone" banner. Used in two
 * places today:
 *   - /s/[slug]/* (shopper PWA, per-store name + dismiss key)
 *   - /(app)/* (merchant portal, "BevTek" + a "portal" dismiss key)
 *
 * Behaviour:
 *   - Already running standalone (display-mode OR iOS navigator.standalone):
 *     never renders.
 *   - Previously dismissed (per-key localStorage flag): hidden until
 *     the user clears site data or we change the key.
 *   - Chromium: captures beforeinstallprompt and triggers the native
 *     install dialog when the user taps Install.
 *   - iOS Safari: opens an instruction sheet (share icon → Add to
 *     Home Screen). iOS has no programmatic install API.
 *
 * Architecture note:
 *   - useSyncExternalStore reads browser state without an effect — that's
 *     React 19's prescribed pattern for "browser values read during render"
 *     and avoids the cascading-render warning.
 *   - useEffect is reserved for the live beforeinstallprompt listener.
 */
export function InstallPrompt({
  appName,
  dismissKey,
  /**
   * Optional copy override. Default is fine for both callers; pass a
   * custom subline if you want different wording per surface.
   */
  subline = "on your phone for one-tap access.",
}: {
  appName: string;
  dismissKey: string;
  subline?: string;
}) {
  const env = useSyncExternalStore(
    noopSubscribe,
    envSnapshotFor(dismissKey),
    getServerSnapshot,
  );
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissedLocally, setDismissedLocally] = useState(false);
  const [showIosSheet, setShowIosSheet] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (env.isStandalone) return;
    // Capture Chromium's beforeinstallprompt so we can call .prompt()
    // when the user taps Install. Chrome only fires it once; if we
    // don't hold onto it, we lose the chance.
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [env.isStandalone]);

  if (env.isStandalone) return null;
  if (env.dismissed || dismissedLocally) return null;
  // On non-iOS browsers without a captured install event, the browser
  // either doesn't support PWA install or hasn't decided we're
  // installable yet. Hide the banner — better to show nothing than a
  // dead button.
  if (!env.isIOS && !installEvent) return null;

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        `${DISMISS_STORAGE_PREFIX}${dismissKey}`,
        String(Date.now()),
      );
    }
    setDismissedLocally(true);
  }

  async function install() {
    if (env.isIOS) {
      // iOS Safari has no programmatic install API. Open the
      // instruction sheet — user does the rest manually.
      setShowIosSheet(true);
      return;
    }
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    setInstallEvent(null);
    if (choice.outcome === "dismissed") dismiss();
  }

  return (
    <>
      <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-gold)]/5">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-2.5 flex items-center gap-3">
          <span className="text-sm">
            <span className="font-medium">Install {appName}</span>{" "}
            <span className="text-[color:var(--color-muted)]">{subline}</span>
          </span>
          <span className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={install}
              className="rounded-md bg-[color:var(--color-gold)] hover:bg-[color:var(--color-gold-hover)] text-white px-3 py-1.5 text-xs font-medium"
            >
              Install
            </button>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss install banner"
              className="text-[color:var(--color-muted)] hover:text-[color:var(--color-fg)] px-1"
            >
              ×
            </button>
          </span>
        </div>
      </div>

      {showIosSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4"
          onClick={() => setShowIosSheet(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold">
              Install {appName}
            </h3>
            <ol className="space-y-2 text-sm text-[color:var(--color-muted)]">
              <li>
                1. Tap the share icon{" "}
                <span aria-hidden="true">⎋</span> at the bottom of Safari.
              </li>
              <li>2. Scroll and choose &ldquo;Add to Home Screen&rdquo;.</li>
              <li>3. Tap &ldquo;Add&rdquo; in the top right.</li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIosSheet(false)}
              className="w-full rounded-md bg-[color:var(--color-fg)] hover:opacity-90 text-white py-2.5 text-sm font-medium"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
