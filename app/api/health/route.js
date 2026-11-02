import { connection } from "next/server";
import { getConfigState, getPool } from "@/lib/db";

function publicError(error) {
  const message =
    error instanceof Error && error.message ? error.message : "database error";
  const password = process.env.MYSQL_PASSWORD;

  if (password && message.includes(password)) {
    return message.split(password).join("[redacted]");
  }

  return message;
}

export async function GET() {
  await connection();

  if (!getConfigState().configured) {
    return Response.json({ ok: false, database: "not_configured" });
  }

  try {
    const pool = getPool();
    await pool.query("SELECT 1");
    return Response.json({ ok: true, database: "connected" });
  } catch (error) {
    return Response.json({
      ok: false,
      database: "error",
      error: publicError(error),
    });
  }
}
