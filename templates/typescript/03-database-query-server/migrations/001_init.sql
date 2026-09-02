-- 001_init.sql
-- Example migration: creates users and posts tables for the database query server.
--
-- Run with: psql "$DATABASE_URL" -f migrations/001_init.sql

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id          SERIAL PRIMARY KEY,
  username    VARCHAR(50)  NOT NULL UNIQUE,
  email       VARCHAR(255) NOT NULL UNIQUE,
  full_name   VARCHAR(100),
  bio         TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  body        TEXT,
  published   BOOLEAN NOT NULL DEFAULT FALSE,
  view_count  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_posts_user_id    ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_published  ON posts(published);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);

-- Example seed data
INSERT INTO users (username, email, full_name, bio) VALUES
  ('alice',   'alice@example.com',   'Alice Johnson',  'Software engineer who loves databases.'),
  ('bob',     'bob@example.com',     'Bob Smith',      'Tech blogger and open source enthusiast.'),
  ('charlie', 'charlie@example.com', 'Charlie Brown',  'Data analyst with a passion for SQL.')
ON CONFLICT (username) DO NOTHING;

INSERT INTO posts (user_id, title, body, published, view_count) VALUES
  (1, 'Getting Started with PostgreSQL', 'PostgreSQL is a powerful open-source relational database...', true,  152),
  (1, 'Understanding Indexes',           'Indexes are critical for query performance...',              true,  89),
  (2, 'My Journey into Open Source',     'How I got started contributing to open source...',           true,  234),
  (2, 'Draft: Advanced SQL Techniques',  'This is a draft post about window functions...',             false, 0),
  (3, 'Data Analysis Best Practices',    'Tips for effective data analysis workflows...',              true,  67)
ON CONFLICT DO NOTHING;
