import mysql from 'mysql2/promise';
import type { PoolConnection } from 'mysql2/promise';
import { env } from '../../config/env.js';
export const pool = mysql.createPool({
  host: env.DB_HOST,
  port: env.DB_PORT,
  user: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  connectionLimit: env.DATABASE_POOL_MAX,
  waitForConnections: true,
  queueLimit: 50,
  connectTimeout: 5000,
  enableKeepAlive: true,
  multipleStatements: false,
  supportBigNumbers: true,
  bigNumberStrings: true,
  decimalNumbers: false,
  dateStrings: true,
  timezone: '+00:00',
  charset: 'utf8mb4',
});
export async function withConnection<T>(
  work: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    // Handshake uses an 8-bit charset ID; set MySQL 8 collation after connecting.
    await connection.query('SET NAMES utf8mb4 COLLATE utf8mb4_0900_as_cs');
    await connection.query("SET SESSION time_zone = '+00:00'");
    await connection.query('SET SESSION innodb_lock_wait_timeout = ?', [
      env.DB_LOCK_TIMEOUT_SECONDS,
    ]);
    return await work(connection);
  } finally {
    connection.release();
  }
}
export async function checkDatabase(): Promise<void> {
  await withConnection(async (connection) => {
    await connection.query('SELECT 1');
  });
}
