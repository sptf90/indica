import mysql from "mysql2/promise";

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

let pool;

export function getPool() {
  if (!getConfigState().configured) {
    return null;
  }

  if (!pool) {
    pool = mysql.createPool({
      host: process.env.MYSQL_HOST,
      port: Number(process.env.MYSQL_PORT) || 3306,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      database: process.env.MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 5,
    });
  }

  return pool;
}
