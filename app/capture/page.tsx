import type { Metadata } from "next";
import CaptureWindow from "@/components/CaptureWindow";

export const metadata: Metadata = { title: "Quick add" };

export default function CapturePage() {
  return <CaptureWindow />;
}
