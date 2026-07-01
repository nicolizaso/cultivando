-- Migration: Add Fertilizers and Fertilizer Combos

CREATE TABLE IF NOT EXISTS fertilizers (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    brand TEXT NOT NULL,
    stage TEXT NOT NULL CHECK (stage IN ('enraizamiento', 'vegetativo', 'floracion', 'lavado', 'todo')),
    dose_type TEXT NOT NULL CHECK (dose_type IN ('fija', 'semanal')),
    dose_fixed NUMERIC,
    dose_weekly JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS fertilizer_combos (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    products JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE fertilizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE fertilizer_combos ENABLE ROW LEVEL SECURITY;

-- Create Policies
CREATE POLICY "Users can view their own fertilizers"
    ON fertilizers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own fertilizers"
    ON fertilizers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fertilizers"
    ON fertilizers FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fertilizers"
    ON fertilizers FOR DELETE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own fertilizer combos"
    ON fertilizer_combos FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own fertilizer combos"
    ON fertilizer_combos FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own fertilizer combos"
    ON fertilizer_combos FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own fertilizer combos"
    ON fertilizer_combos FOR DELETE
    USING (auth.uid() = user_id);
