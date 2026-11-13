"use client";

import { useEffect } from "react";
import QuickAdd from "@/components/QuickAdd";

const ID = "doem-capture";

/** The 560x64 global-capture window: the composer and nothing else. */
export default function CaptureWindow() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = [html.style.background, body.style.background];
    html.style.background = "transparent";
    body.style.background = "transparent";
    const refocus = () => document.getElementById(ID)?.focus();
    window.addEventListener("focus", refocus);
    return () => {
      window.removeEventListener("focus", refocus);
      html.style.background = prev[0];
      body.style.background = prev[1];
    };
  }, []);

  return (
    <div className="p-1.5">
      <QuickAdd
        id={ID}
        defaultScheduled={null}
        autoFocus
        saveOnWindowBlur
        dumpPreview={false}
        onSaved={({ stay }) => {
          window.doem?.captureSaved?.();
          if (!stay) window.doem?.closeCapture?.();
        }}
        onEscape={() => window.doem?.closeCapture?.()}
      />
    </div>
  );
}
