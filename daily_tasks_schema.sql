-- Table for Daily Tasks
CREATE TABLE IF NOT EXISTS daily_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    task_name TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT FALSE,
    start_time TEXT,
    for_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE daily_tasks ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own tasks" ON daily_tasks
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tasks" ON daily_tasks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tasks" ON daily_tasks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tasks" ON daily_tasks
    FOR DELETE USING (auth.uid() = user_id);

-- Add completed_days to profiles if not exists (for activity calendar)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS completed_days JSONB DEFAULT '[]'::jsonb;
