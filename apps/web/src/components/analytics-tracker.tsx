import { useEffect } from "react";
import { useLocation } from "react-router-dom";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
    __donggeuriAnalyticsLoaded?: boolean;
    __donggeuriAnalyticsConfigured?: boolean;
  }
}

const GOOGLE_TAG_SRC = "https://www.googletagmanager.com/gtag/js?id=";

function loadGoogleTag(measurementId: string) {
  if (typeof document === "undefined" || window.__donggeuriAnalyticsLoaded) {
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.src = `${GOOGLE_TAG_SRC}${measurementId}`;
  document.head.appendChild(script);
  window.__donggeuriAnalyticsLoaded = true;
}

function ensureAnalyticsRuntime() {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag =
    window.gtag ??
    ((...args: unknown[]) => {
      window.dataLayer?.push(args);
    });
}

export function AnalyticsTracker() {
  const location = useLocation();
  const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

  useEffect(() => {
    if (!measurementId || typeof window === "undefined") {
      return;
    }

    ensureAnalyticsRuntime();
    loadGoogleTag(measurementId);

    if (!window.__donggeuriAnalyticsConfigured) {
      window.gtag?.("js", new Date());
      window.gtag?.("config", measurementId, {
        send_page_view: false,
      });
      window.__donggeuriAnalyticsConfigured = true;
    }
  }, [measurementId]);

  useEffect(() => {
    if (!measurementId || typeof window === "undefined") {
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      window.gtag?.("event", "page_view", {
        page_title: document.title,
        page_location: window.location.href,
        page_path: `${location.pathname}${location.search}`,
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.pathname, location.search, measurementId]);

  return null;
}
