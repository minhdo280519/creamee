import { createPool, OkPacket, Pool, PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

const pool: Pool = createPool(
  process.env.MYSQL_URL
    ? {
        uri: process.env.MYSQL_URL,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      }
    : {
        host: process.env.MYSQL_HOST ?? '127.0.0.1',
        port: Number(process.env.MYSQL_PORT ?? 3306),
        user: process.env.MYSQL_USER ?? 'root',
        password: process.env.MYSQL_PASSWORD ?? '',
        database: process.env.MYSQL_DATABASE ?? 'creamee',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
      },
);

export type QueryResult<T = RowDataPacket> = {
  rows: T[];
  affectedRows: number;
  insertId: number;
};

export async function query<T = RowDataPacket>(
  sql: string,
  params: unknown[] = [],
): Promise<QueryResult<T>> {
  const [rows] = await pool.query<RowDataPacket[] | OkPacket | ResultSetHeader>(sql, params);

  if (Array.isArray(rows)) {
    return {
      rows: rows as T[],
      affectedRows: 0,
      insertId: 0,
    };
  }

  return {
    rows: [],
    affectedRows: rows.affectedRows ?? 0,
    insertId: rows.insertId ?? 0,
  };
}

export async function transaction<T>(
  callback: (connection: PoolConnection) => Promise<T>,
): Promise<T> {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
