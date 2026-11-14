import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Instrument_Serif,
} from "next/font/google";
import "./globals.css";
import AppChrome from "@/components/AppChrome";
import { THEME_COLOR_DARK, THEME_COLOR_LIGHT, TITLE_TEMPLATE } from "@/lib/app-meta";

// Runs before paint so the saved theme applies with no light->dark flash,
// and so vibrancy's transparent-body CSS (globals.css) only kicks in under
// Electron. window.doem is injected by the preload script, which runs
// before any of the page's own scripts, so it's reliably present here.
const THEME_INIT = `(function(){try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t;}catch(e){}try{if(window.doem)document.documentElement.dataset.desktop="";}catch(e){}})();`;

// v2 fonts: Geist for the UI, Geist Mono for numbers and small technical
// labels, Instrument Serif for the moment line.
const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  subsets: ["latin"],
  weight: "400",
  style: "normal",
});

export const metadata: Metadata = {
  title: { default: "Today", template: TITLE_TEMPLATE },
  description: "What you're actually doing today, and whether it fits.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: THEME_COLOR_LIGHT },
    { media: "(prefers-color-scheme: dark)", color: THEME_COLOR_DARK },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
      </head>
      <body className="min-h-full">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
