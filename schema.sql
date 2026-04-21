-- 1. Create Students table
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uid TEXT UNIQUE NOT NULL, -- RFID Tag ID
  name TEXT NOT NULL,
  roll_no TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Create Scans log table
CREATE TABLE scans (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  student_uid TEXT REFERENCES students(uid),
  type TEXT NOT NULL CHECK (type IN ('ENTRY', 'EXIT')),
  timestamp TIMESTAMPTZ DEFAULT now()
);

-- 3. Create Sessions table (for analytics and easy lookup)
CREATE TABLE sessions (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  student_uid TEXT REFERENCES students(uid),
  entry_time TIMESTAMPTZ NOT NULL,
  exit_time TIMESTAMPTZ,
  duration_minutes INTEGER,
  status TEXT DEFAULT 'ACTIVE', -- 'ACTIVE', 'COMPLETED', 'STALE'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indices for performance
CREATE INDEX idx_scans_uid ON scans(student_uid);
CREATE INDEX idx_sessions_active ON sessions(student_uid) WHERE exit_time IS NULL;
CREATE INDEX idx_sessions_date ON sessions(entry_time);
