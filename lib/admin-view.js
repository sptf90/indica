import { cookies } from "next/headers";
import { ADMIN_VIEW_COOKIE, SESSION_DAYS } from "./constants";

export const ADMIN_VIEW_MODES = ["admin", "user", "company"];

export function normalizeAdminViewMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return ADMIN_VIEW_MODES.includes(mode) ? mode : "admin";
}

export async function readAdminViewCookie() {
  const jar = await cookies();
  return normalizeAdminViewMode(jar.get(ADMIN_VIEW_COOKIE)?.value);
}

export async function setAdminViewCookie(mode) {
  const jar = await cookies();
  const next = normalizeAdminViewMode(mode);
  jar.set(ADMIN_VIEW_COOKIE, next, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
  return next;
}

export async function clearAdminViewCookie() {
  const jar = await cookies();
  jar.set(ADMIN_VIEW_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
