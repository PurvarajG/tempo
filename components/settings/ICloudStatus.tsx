export default function ICloudStatus({ configured }: { configured: boolean }) {
  return (
    <div className="px-3 pb-3">
      <p className="pb-1 pt-4 text-meta text-ink-3">Show your iCloud events</p>
      {configured ? (
        <p className="mt-2 text-secondary text-ink-3">
          <span className="text-ink">Connected.</span> Your iCloud events appear on the Calendar
          page, read-only. They are fetched fresh every few minutes and never written back.
        </p>
      ) : (
        <>
          <p className="mt-2 text-secondary text-ink">iCloud events aren&apos;t connected yet.</p>
          <p className="mt-3 text-secondary text-ink-3">
            In the desktop app, open{" "}
            <span className="text-ink">File, Calendar Integration Settings</span> and fill in{" "}
            <code className="font-mono text-meta">icloudAppleId</code> and{" "}
            <code className="font-mono text-meta">icloudAppPassword</code>, then restart Doem.
            Running from source, set <code className="font-mono text-meta">ICLOUD_APPLE_ID</code>{" "}
            and <code className="font-mono text-meta">ICLOUD_APP_PASSWORD</code> instead.
          </p>
          <p className="mt-3 text-secondary text-ink-3">
            The password must be an app-specific password from appleid.apple.com. iCloud CalDAV
            rejects your real Apple ID password once two-factor is on.
          </p>
        </>
      )}
    </div>
  );
}
