-- UNIFIED DAILY TASKS SETUP
-- This script safely creates the table and ensures it has the 3-state status system.

CREATE TABLE IF NOT EXISTS daily_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    status TEXT DEFAULT 'Pending',
    start_time TEXT,
    for_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure correct columns exist (in case it was created partially before)
DO $$
BEGIN
    -- Add status if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='status') THEN
        ALTER TABLE daily_tasks ADD COLUMN status TEXT DEFAULT 'Pending';
    END IF;
    
    -- Drop old boolean column if it exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='is_completed') THEN
        ALTER TABLE daily_tasks DROP COLUMN is_completed;
    END IF;

    -- Ensure for_date exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='for_date') THEN
        ALTER TABLE daily_tasks ADD COLUMN for_date DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;

-- Enable RLS
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

-- Policies (using IF NOT EXISTS logic via DO block to prevent errors on re-run)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_tasks' AND policyname = 'Users can view their own tasks') THEN
        CREATE POLICY "Users can view their own tasks" ON daily_tasks FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_tasks' AND policyname = 'Users can insert their own tasks') THEN
        CREATE POLICY "Users can insert their own tasks" ON daily_tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_tasks' AND policyname = 'Users can update their own tasks') THEN
        CREATE POLICY "Users can update their own tasks" ON daily_tasks FOR UPDATE USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'daily_tasks' AND policyname = 'Users can delete their own tasks') THEN
        CREATE POLICY "Users can delete their own tasks" ON daily_tasks FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- Add completed_days to profiles if not exists
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS completed_days JSONB DEFAULT '[]'::jsonb;
