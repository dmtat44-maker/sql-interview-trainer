CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic text NOT NULL,
  level text NOT NULL CHECK (level IN ('easy', 'mid', 'hard')),
  type text NOT NULL DEFAULT 'write_sql',
  question text NOT NULL,
  schema_text text DEFAULT '',
  correct_answer text NOT NULL,
  explanation text DEFAULT '',
  checks jsonb DEFAULT '[]'::jsonb,
  options jsonb DEFAULT '[]'::jsonb,
  correct_option integer,
  source text DEFAULT 'ai',
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS questions_topic_level_idx
ON public.questions(topic, level);

CREATE TABLE IF NOT EXISTS public.attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid REFERENCES public.questions(id) ON DELETE CASCADE,
  user_answer text,
  is_correct boolean,
  mistakes jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now()
);
