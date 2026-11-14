"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

/**
 * The subscribe URL is built in the browser rather than on the server: the app
 * runs behind a proxy in production, so `window.location` is the only place
 * that reliably knows the host you actually reached it on.
 *
 * Deliberately `http(s)://`, not `webcal://`: macOS Calendar's `webcal:`
 * handler tries HTTPS first regardless of what the target actually serves,
 * and does not fall back to plain HTTP on failure — confirmed via
 * `log show`, which shows CalendarAgent's fetch dying with
 * NSURLErrorSecureConnectionFailed (-1200) then NSURLErrorUnsupportedURL
 * (-1002) against this exact feed. Handing Calendar the real scheme we're
 * actually serving sidesteps that translation entirely.
 */
function feedUrl(token: string): string {
  return `${window.location.protocol}//${window.location.host}/api/calendar-feed?token=${encodeURIComponent(token)}`;
}

/** The host never changes under us, so there is nothing to subscribe to. */
const noSubscription = () => () => {};

export default function CalendarFeed({ token }: { token: string | null }) {
  const [copied, setCopied] = useState(false);

  // The server has no `window`, so it renders an empty field and the client
  // fills it in on hydration — without a render-phase mismatch or a setState
  // in an effect. Equal strings are `Object.is`-equal, so this never loops.
  const url = useSyncExternalStore(
    noSubscription,
    () => (token ? feedUrl(token) : ""),
    () => "",
  );

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const sub = <p className="pb-1 pt-4 text-meta text-ink-3">Subscribe to your tasks</p>;

  if (!token) {
    return (
      <div className="px-3 pb-3">
        {sub}
        <p className="mt-2 text-secondary text-ink">The calendar feed isn&apos;t set up yet.</p>
        <p className="mt-3 text-secondary text-ink-3">
          In the desktop app, open{" "}
          <span className="text-ink">File, Calendar Integration Settings</span>. A token is
          generated for you on first launch; restart Doem if the file was empty. Running from
          source instead, set <code className="font-mono text-meta">CALENDAR_FEED_SECRET</code> to
          a long random string in your environment and restart.
        </p>
        <p className="mt-3 text-secondary text-ink-3">
          Treat it like a password. It is the only thing standing between your task list and anyone
          who guesses the URL.
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3">
      {sub}
      <p className="mt-2 text-secondary text-ink-3">
        Add this URL in Apple Calendar under{" "}
        <span className="text-ink">File, New Calendar Subscription</span>, or open it on your
        phone. Your open tasks appear as events; completed ones drop off at the next refresh.
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Input
          variant="field"
          readOnly
          value={url}
          aria-label="Calendar feed URL"
          onFocus={(e) => e.currentTarget.select()}
          wrapperClassName="min-w-0 flex-1"
          className="font-mono text-meta"
        />
        <Button
          variant="chip"
          size="sm"
          icon={copied ? "check" : undefined}
          onClick={async () => {
            await navigator.clipboard?.writeText(url);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>

      <p className="mt-3 text-meta text-ink-3">
        In the desktop app the feed is served by Doem itself, so Apple Calendar only refreshes
        while Doem is open. Close it and you keep seeing the last events it fetched.
      </p>

      <p className="mt-3 text-meta text-ink-3">
        Anyone with this link can read your tasks, because it carries the feed token. Rotate{" "}
        <code className="font-mono text-meta">CALENDAR_FEED_SECRET</code> to revoke it.
      </p>
    </div>
  );
}
