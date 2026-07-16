import pg from 'pg';
import { config } from './config.js';

// Vercel Postgres usually exposes POSTGRES_URL.
const pool = new pg.Pool({
  connectionString: process.env.POSTGRES_URL || 'postgresql://postgres:postgres@localhost:5432/volunteer',
  ...(process.env.POSTGRES_URL ? { ssl: { rejectUnauthorized: false } } : {})
});

// Convert SQLite `?` placeholders to Postgres `$1, $2, ...`
function convertQuery(sql) {
  let i = 1;
  return sql.replace(/\?/g, () => `$${i++}`);
}

export const db = {
  prepare: (sql) => {
    const pgSql = convertQuery(sql);
    return {
      get: async (...args) => {
        const res = await pool.query(pgSql, args);
        return res.rows[0];
      },
      all: async (...args) => {
        const res = await pool.query(pgSql, args);
        return res.rows;
      },
      run: async (...args) => {
        let finalSql = pgSql;
        // Postgres needs RETURNING id for inserts if we want lastInsertRowid
        if (finalSql.trim().toUpperCase().startsWith('INSERT') && !finalSql.includes('RETURNING')) {
          finalSql += ' RETURNING id';
        }
        const res = await pool.query(finalSql, args);
        return { lastInsertRowid: res.rows[0]?.id };
      }
    };
  },
  transaction: async (fn) => {
    return await fn();
  },
  exec: async (sql) => {
    await pool.query(sql);
  }
};

export async function logActivity(actorId, targetId, action, details) {
  await db.prepare(
    `INSERT INTO activity_log (actor_id, target_id, action, details) VALUES (?, ?, ?, ?)`
  ).run(actorId ?? null, targetId ?? null, action, details ? String(details) : null);
}
