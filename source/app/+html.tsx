import React, { type ReactNode } from "react";
import { ScrollViewStyleReset } from "expo-router/html";

type HtmlProps = {
  children: ReactNode;
};

const THEME_BOOTSTRAP_SCRIPT = `(function () {
  var storageKey = "app-theme";
  var validThemes = ["light", "dark", "system"];
  var preference = "system";

  try {
    var stored = window.localStorage.getItem(storageKey);
    if (stored === "green") {
      preference = "dark";
      window.localStorage.setItem(storageKey, preference);
    } else if (stored && validThemes.indexOf(stored) !== -1) {
      preference = stored;
    }
  } catch (error) {}

  var mediaQuery = typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)")
    : null;
  var resolved = preference === "system"
    ? mediaQuery && mediaQuery.matches
      ? "dark"
      : "light"
    : preference;

  var root = document.documentElement;
  root.setAttribute("data-app-theme", preference);
  root.setAttribute("data-app-theme-resolved", resolved);
  root.style.colorScheme = resolved === "light" ? "light" : "dark";

  var themeColor = resolved === "light" ? "#ecfdf3" : "#020617";
  var themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", themeColor);
  }
})();`;

const STARTUP_INLINE_STYLES = `:root{--gg-app-loading-base:#ecfdf3;--gg-app-loading-gradient-1:#f6fff9;--gg-app-loading-gradient-2:#e5fbee;--gg-app-loading-gradient-3:#d7f6e4;--gg-app-loading-overlay-top-start:rgba(255,255,255,0.76);--gg-app-loading-overlay-top-mid:rgba(255,255,255,0.18);--gg-app-loading-overlay-bottom-start:rgba(16,185,129,0.1);--gg-app-loading-overlay-bottom-mid:rgba(96,165,250,0.05);--gg-app-loading-mark-circle:#29c766;--gg-app-loading-text:#052e16;color-scheme:light}:root[data-app-theme-resolved="dark"]{--gg-app-loading-base:#020617;--gg-app-loading-gradient-1:#020617;--gg-app-loading-gradient-2:#111827;--gg-app-loading-gradient-3:#03120c;--gg-app-loading-overlay-top-start:rgba(52,211,153,0.1);--gg-app-loading-overlay-top-mid:rgba(255,255,255,0.02);--gg-app-loading-overlay-bottom-start:rgba(96,165,250,0.1);--gg-app-loading-overlay-bottom-mid:rgba(0,0,0,0.06);--gg-app-loading-mark-circle:#2dcc6d;--gg-app-loading-text:#ffffff;color-scheme:dark}:root[data-app-theme-resolved="green"]{--gg-app-loading-base:#020617;--gg-app-loading-gradient-1:#020617;--gg-app-loading-gradient-2:#111827;--gg-app-loading-gradient-3:#03120c;--gg-app-loading-overlay-top-start:rgba(52,211,153,0.1);--gg-app-loading-overlay-top-mid:rgba(255,255,255,0.02);--gg-app-loading-overlay-bottom-start:rgba(96,165,250,0.1);--gg-app-loading-overlay-bottom-mid:rgba(0,0,0,0.06);--gg-app-loading-mark-circle:#2dcc6d;--gg-app-loading-text:#ffffff;color-scheme:dark}html,body{height:100%;min-height:100%;background-color:var(--gg-app-loading-base)}body{min-height:100vh;min-height:100dvh}.gg-app-loading{position:relative;display:flex;flex:1 1 auto;height:100%;min-height:100%;width:100%;overflow:hidden;background-color:var(--gg-app-loading-base)}.gg-app-loading__layer{position:absolute;inset:0;pointer-events:none}.gg-app-loading__layer--base{background-image:linear-gradient(180deg,var(--gg-app-loading-gradient-1) 0%,var(--gg-app-loading-gradient-2) 50%,var(--gg-app-loading-gradient-3) 100%)}.gg-app-loading__layer--top{background-image:linear-gradient(128.66deg,var(--gg-app-loading-overlay-top-start) 0%,var(--gg-app-loading-overlay-top-mid) 48%,transparent 100%)}.gg-app-loading__layer--bottom{background-image:linear-gradient(-51.34deg,var(--gg-app-loading-overlay-bottom-start) 0%,var(--gg-app-loading-overlay-bottom-mid) 45%,transparent 100%)}.gg-app-loading__content{position:relative;z-index:1;display:flex;min-height:100%;width:100%;flex:1 1 auto;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:0 24px;text-align:center}.gg-app-loading__mark{width:96px;height:96px;flex-shrink:0}.gg-app-loading__mark-circle{fill:var(--gg-app-loading-mark-circle)}.gg-app-loading__mark-hat{fill:#050505}.gg-app-loading__mark-stroke{stroke:#050505}.gg-app-loading__text{margin:0;color:var(--gg-app-loading-text);font-size:16px;font-weight:600;font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}`;

export default function Html({ children }: HtmlProps) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta name="color-scheme" content="light dark" />
        <meta name="theme-color" content="#ecfdf3" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Gator Guide" />
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
        <style dangerouslySetInnerHTML={{ __html: STARTUP_INLINE_STYLES }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
