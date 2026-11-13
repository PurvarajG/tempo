import { redirect } from "next/navigation";

/** Tracking settings now live on the Settings page. */
export default function TrackingSettingsPage() {
  redirect("/settings#tracking");
}
