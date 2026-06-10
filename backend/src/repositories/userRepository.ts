import db from "../database/init.js";
import type { User } from "../types/index.js";

function mapUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string,
    password: row.password as string,
    displayName: row.display_name as string,
    role: row.role as User["role"],
  };
}

export function findByUsername(username: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE username = ?").get(username) as Record<string, unknown> | undefined;
  return row ? mapUser(row) : null;
}

export function findById(id: string): User | null {
  const row = db.prepare("SELECT * FROM users WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapUser(row) : null;
}
