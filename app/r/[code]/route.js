import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import {
  applyVisitorCookie,
  findOwnerByShareCode,
  recordShareVisit,
  resolveVisitorId,
} from "@/lib/share-links";

/**
 * Link de partilha: /r/[codigo]
 * Regista visita distinta e encaminha para home (auth) ou cadastro (anónimo).
 */
export async function GET(request, { params }) {
  const { code } = await params;
  const origin = new URL(request.url).origin;

  if (!getPool()) {
    return NextResponse.redirect(new URL("/register", origin));
  }

  const owner = await findOwnerByShareCode(code);
  if (!owner) {
    return NextResponse.redirect(new URL("/register?ref=invalid", origin));
  }

  const viewer = await getCurrentUser();
  const { visitorId, setCookie } = resolveVisitorId(request);

  try {
    await recordShareVisit({
      ownerUserId: owner.id,
      visitorUserId: viewer?.id || null,
      visitorId,
    });
  } catch {
    // Não bloquear o redirect se o registo falhar
  }

  const target = viewer
    ? new URL("/", origin)
    : (() => {
        const u = new URL("/register", origin);
        u.searchParams.set("ref", owner.share_code);
        return u;
      })();

  const response = NextResponse.redirect(target);
  applyVisitorCookie(response, setCookie);
  return response;
}
