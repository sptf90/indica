import mysql from "mysql2/promise";
import { mapRow } from "./db-row";

const REQUIRED = ["MYSQL_HOST", "MYSQL_USER", "MYSQL_PASSWORD", "MYSQL_DATABASE"];

export function getConfigState() {
  const missing = REQUIRED.filter((name) => {
    const value = process.env[name];
    return value === undefined || value === "";
  });

  if (missing.length > 0) {
    return { configured: false, missing };
  }

  return { configured: true, missing: [] };
}

function mapResult(result) {
  // mysql2: [rows, fields] for SELECT; ResultSetHeader for INSERT/UPDATE
  if (!Array.isArray(result)) return result;
  if (result.length >= 1 && Array.isArray(result[0])) {
    const [rows, fields] = result;
    return [rows.map(mapRow), fields];
  }
  return result;
}

function wrapConnection(conn) {
  const originalQuery = conn.query.bind(conn);
  const originalExecute = conn.execute ? conn.execute.bind(conn) : null;

  conn.query = async (...args) => mapResult(await originalQuery(...args));
  if (originalExecute) {
    conn.execute = async (...args) => mapResult(await originalExecute(...args));
  }
  return conn;
}

function wrapPool(rawPool) {
  const originalQuery = rawPool.query.bind(rawPool);
  const originalExecute = rawPool.execute
    ? rawPool.execute.bind(rawPool)
    : null;
  const originalGetConnection = rawPool.getConnection.bind(rawPool);

  rawPool.query = async (...args) => mapResult(await originalQuery(...args));
  if (originalExecute) {
    rawPool.execute = async (...args) =>
      mapResult(await originalExecute(...args));
  }
  rawPool.getConnection = async (...args) => {
    const conn = await originalGetConnection(...args);
    return wrapConnection(conn);
  };
  return rawPool;
}

let pool;

export function getPool() {
  if (!getConfigState().configured) {
    return null;
  }

  if (!pool) {
    pool = wrapPool(
      mysql.createPool({
        host: process.env.MYSQL_HOST,
        port: Number(process.env.MYSQL_PORT) || 3306,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 5,
      })
    );
  }

  return pool;
}
