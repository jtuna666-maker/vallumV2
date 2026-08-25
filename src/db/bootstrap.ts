import "server-only";
import { pool } from "@/db";

/**
 * Self-healing schema bootstrap for preview/sandbox environments where the
 * PostgreSQL volume can be recreated independently of the app process.
 *
 * Production migrations still use Drizzle (`npx drizzle-kit push`), but this
 * idempotent DDL guarantees /api/health prepares an empty preview database
 * before the platform declares the app healthy.
 */
let ready: Promise<void> | null = null;

export function ensureDatabaseSchema(): Promise<void> {
  ready ??= bootstrap().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}

async function bootstrap(): Promise<void> {
  await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL UNIQUE,
      name text NOT NULL DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS login_codes (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      code_hash text NOT NULL,
      attempts integer NOT NULL DEFAULT 0,
      expires_at timestamp NOT NULL,
      used_at timestamp,
      created_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS projects (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      author_name text NOT NULL,
      dedication text NOT NULL DEFAULT '',
      theme text NOT NULL DEFAULT 'parchment',
      owner_id uuid REFERENCES users(id) ON DELETE SET NULL,
      share_token text NOT NULL DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      era text NOT NULL,
      title text NOT NULL,
      subtitle text NOT NULL DEFAULT '',
      order_index integer NOT NULL,
      content text NOT NULL DEFAULT '',
      image_url text NOT NULL DEFAULT '',
      image_caption text NOT NULL DEFAULT '',
      status text NOT NULL DEFAULT 'unwritten',
      updated_at timestamp NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS questions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      chapter_id uuid NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
      text text NOT NULL,
      order_index integer NOT NULL,
      answer text NOT NULL DEFAULT '',
      answered_at timestamp
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role text NOT NULL DEFAULT 'editor',
      created_at timestamp NOT NULL DEFAULT now(),
      PRIMARY KEY (project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS print_orders (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      email text NOT NULL DEFAULT '',
      edition text NOT NULL DEFAULT 'heirloom',
      quantity integer NOT NULL DEFAULT 1,
      unit_cents integer NOT NULL DEFAULT 8900,
      amount_cents integer NOT NULL DEFAULT 8900,
      discount_rate integer NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'pending',
      stripe_session_id text NOT NULL DEFAULT '',
      lulu_job_id text NOT NULL DEFAULT '',
      ship_name text NOT NULL DEFAULT '',
      ship_line1 text NOT NULL DEFAULT '',
      ship_line2 text NOT NULL DEFAULT '',
      ship_city text NOT NULL DEFAULT '',
      ship_state text NOT NULL DEFAULT '',
      ship_postal text NOT NULL DEFAULT '',
      ship_country text NOT NULL DEFAULT '',
      created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now()
    );
  `);

  // Upgrade-safe column additions for previews restored from an older schema.
  await pool.query(`
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE SET NULL;
    ALTER TABLE projects ADD COLUMN IF NOT EXISTS share_token text NOT NULL DEFAULT '';
    ALTER TABLE chapters ADD COLUMN IF NOT EXISTS image_url text NOT NULL DEFAULT '';
    ALTER TABLE chapters ADD COLUMN IF NOT EXISTS image_caption text NOT NULL DEFAULT '';
    ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS edition text NOT NULL DEFAULT 'heirloom';
    ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;
    ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS unit_cents integer NOT NULL DEFAULT 8900;
    ALTER TABLE print_orders ADD COLUMN IF NOT EXISTS discount_rate integer NOT NULL DEFAULT 0;
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS projects_owner_idx ON projects(owner_id);
    CREATE INDEX IF NOT EXISTS chapters_project_idx ON chapters(project_id);
    CREATE INDEX IF NOT EXISTS questions_chapter_idx ON questions(chapter_id);
    CREATE INDEX IF NOT EXISTS login_codes_email_idx ON login_codes(email);
    CREATE INDEX IF NOT EXISTS print_orders_project_idx ON print_orders(project_id);
  `);
}
