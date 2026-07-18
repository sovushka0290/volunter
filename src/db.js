// Postgres отключен. Все данные хранятся в Vercel Blob.
export const db = {
  prepare: () => ({
    all: () => [],
    get: () => null,
    run: () => ({ lastInsertRowid: 0 })
  }),
  transaction: async (fn) => {
    return await fn();
  },
  exec: async () => {}
};

export async function logActivity(actorId, targetId, action, details) {
  await db.prepare(
    `INSERT INTO activity_log (actor_id, target_id, action, details) VALUES (?, ?, ?, ?)`
  ).run(actorId ?? null, targetId ?? null, action, details ? String(details) : null);
}
