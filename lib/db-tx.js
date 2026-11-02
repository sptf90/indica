import { getPool } from "./db";

export async function withTransaction(fn) {
  const pool = getPool();
  if (!pool) {
    const err = new Error("Banco não configurado");
    err.status = 503;
    throw err;
  }
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (error) {
    try {
      await conn.rollback();
    } catch {
      // ignore rollback errors
    }
    throw error;
  } finally {
    conn.release();
  }
}
