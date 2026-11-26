"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(pointer: coarse)";

function subscribe(onChange) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

// Verdadeiro em celulares/tablets (ponteiro por toque). No servidor e na hidratação é falso.
export function useTouchDevice() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}

function subscribeNoop() {
  return () => {};
}

// A Contact Picker API existe só em alguns navegadores móveis (ex.: Chrome no Android, via HTTPS).
export function useContactPicker() {
  return useSyncExternalStore(
    subscribeNoop,
    () => "contacts" in navigator && "ContactsManager" in window && window.isSecureContext,
    () => false,
  );
}
