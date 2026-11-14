import Link from "next/link";
import type { ReactNode } from "react";
import AppearanceSection from "@/components/settings/AppearanceSection";
import CalendarFeed from "@/components/settings/CalendarFeed";
import DesktopSection from "@/components/settings/DesktopSection";
import ICloudStatus from "@/components/settings/ICloudStatus";
import NavVisibility from "@/components/settings/NavVisibility";
import SettingsNav from "@/components/settings/SettingsNav";
import TodaySection from "@/components/settings/TodaySection";
import TrackingSettings from "@/components/tracking/settings/TrackingSettings";
import Card, { CardHeader } from "@/components/ui/Card";
import Icon, { type IconName } from "@/components/ui/Icon";
import PageHead from "@/components/ui/PageHead";
import { hasDesktopOptions } from "@/lib/desktop-options";

/**
 * Rendered per request, never prerendered: otherwise CALENDAR_FEED_SECRET is
 * read at build time and baked into static HTML, so rotating the secret would
 * need a rebuild. Handing the token to the browser is intentional: its whole
 * job is to end up in a URL you paste into Apple Calendar.
 */
export const dynamic = "force-dynamic";

function Section({
  id,
  label,
  icon,
  right,
  children,
}: {
  id: string;
  label: string;
  icon: IconName;
  right?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-6">
      <CardHeader
        title={label}
        titleId={`${id}-heading`}
        icon={<Icon name={icon} size={16} />}
        right={right}
      />
      {children}
    </Card>
  );
}

export default function SettingsPage() {
  const token = process.env.CALENDAR_FEED_SECRET || null;
  const icloudConfigured = Boolean(process.env.ICLOUD_APPLE_ID && process.env.ICLOUD_APP_PASSWORD);
  const desktop = hasDesktopOptions();

  const sections = [
    { id: "appearance", label: "Appearance" },
    { id: "today", label: "Today" },
    { id: "sidebar", label: "Sidebar" },
    { id: "calendar", label: "Calendar feed" },
    { id: "tracking", label: "Tracking" },
    ...(desktop ? [{ id: "desktop", label: "Desktop" }] : []),
  ];

  return (
    <PageHead
      title="Settings"
      subtitle="How Doem looks, plans your day and works with your Mac."
    >
      <div className="max-w-5xl pb-1 grid grid-cols-1 gap-6 shell:grid-cols-[11rem_minmax(0,1fr)]">
        <SettingsNav sections={sections} />

        <div className="flex min-w-0 flex-col gap-6">
          <Section id="appearance" label="Appearance" icon="sun">
            <AppearanceSection />
          </Section>
          <Section id="today" label="Today" icon="today">
            <TodaySection />
          </Section>
          <Section id="sidebar" label="Sidebar" icon="panel">
            <NavVisibility />
          </Section>
          <Section id="calendar" label="Calendar feed" icon="cal">
            <CalendarFeed token={token} />
            <ICloudStatus configured={icloudConfigured} />
          </Section>
          <Section
            id="tracking"
            label="Tracking"
            icon="chart"
            right={
              <Link href="/tracking" className="hover:text-ink">
                Open Tracking
              </Link>
            }
          >
            <TrackingSettings />
          </Section>
          {desktop && (
            <Section id="desktop" label="Desktop" icon="bell">
              <DesktopSection />
            </Section>
          )}
        </div>
      </div>
    </PageHead>
  );
}
