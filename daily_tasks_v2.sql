-- Update Daily Tasks to 3-state system
ALTER TABLE daily_tasks DROP COLUMN IF EXISTS is_completed;
ALTER TABLE daily_tasks ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';

-- Ensure for_date is included if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='daily_tasks' AND column_name='for_date') THEN
        ALTER TABLE daily_tasks ADD COLUMN for_date DATE DEFAULT CURRENT_DATE;
    END IF;
END $$;
