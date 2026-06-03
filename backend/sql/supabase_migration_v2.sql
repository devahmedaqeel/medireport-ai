-- MediReport AI: Updated Supabase Schema & Migration (v2 - Fixed Casts)
-- Run this in your Supabase SQL Editor to create missing tables and enable security.

-- 1. Profiles: User metadata referencing auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'doctor')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Reports: High-level scan metadata
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT, -- Keep as TEXT to support guest mode references/fallbacks
    report_type TEXT,
    category TEXT,
    overall_risk TEXT,
    ocr_text TEXT,
    english_explanation TEXT,
    roman_urdu_explanation TEXT,
    confidence NUMERIC,
    image_url TEXT,
    pdf_url TEXT,
    manual_review_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Observations: Detailed biomarker extractions
CREATE TABLE IF NOT EXISTS public.observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
    user_id TEXT, -- Keep as TEXT for consistency with reports
    test_name TEXT,
    value NUMERIC,
    unit TEXT,
    range_low NUMERIC,
    range_high NUMERIC,
    status TEXT,
    test_name_confidence NUMERIC,
    value_confidence NUMERIC,
    unit_confidence NUMERIC,
    range_confidence NUMERIC,
    overall_confidence NUMERIC,
    possible_indication TEXT,
    english_explanation TEXT,
    roman_urdu_explanation TEXT,
    manual_review_required BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Feedback: General user feedback (matching backend database_service.py)
CREATE TABLE IF NOT EXISTS public.feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    rating INTEGER,
    comment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Corrections: User corrections on OCR values (matching backend database_service.py)
CREATE TABLE IF NOT EXISTS public.corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
    correction_type TEXT,
    original_data JSONB,
    corrected_data JSONB,
    approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Learning Memory: Verified learning patterns
CREATE TABLE IF NOT EXISTS public.verified_learning_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_type TEXT CHECK (memory_type IN ('alias', 'ocr_correction', 'layout', 'rule')),
    key TEXT UNIQUE,
    value JSONB,
    source TEXT,
    confidence NUMERIC,
    validation_status TEXT DEFAULT 'verified',
    approved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Scan Learning Logs: Trace extraction issues for debugging
CREATE TABLE IF NOT EXISTS public.scan_learning_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT,
    report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
    report_type TEXT,
    category TEXT,
    raw_ocr_text TEXT,
    extracted_json JSONB,
    confidence NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ROW LEVEL SECURITY (RLS) CONFIGURATION
-- ==========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_learning_logs ENABLE ROW LEVEL SECURITY;

-- Note: verified_learning_memory is read-only for users, writeable by admins.
ALTER TABLE public.verified_learning_memory ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies (Uses UUID = UUID)
CREATE POLICY "Allow users to read their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Allow users to update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 2. Reports Policies (Casts auth.uid() to text for text comparison)
CREATE POLICY "Allow users to select their own reports" ON public.reports
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Allow users to insert their own reports" ON public.reports
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Allow users to update their own reports" ON public.reports
    FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Allow users to delete their own reports" ON public.reports
    FOR DELETE USING (auth.uid()::text = user_id);

-- 3. Observations Policies
CREATE POLICY "Allow users to select their own observations" ON public.observations
    FOR SELECT USING (auth.uid()::text = user_id);

CREATE POLICY "Allow users to insert their own observations" ON public.observations
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Allow users to update their own observations" ON public.observations
    FOR UPDATE USING (auth.uid()::text = user_id) WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Allow users to delete their own observations" ON public.observations
    FOR DELETE USING (auth.uid()::text = user_id);

-- 4. Feedback Policies
CREATE POLICY "Allow users to insert feedback" ON public.feedback
    FOR INSERT WITH CHECK (auth.uid()::text = user_id OR user_id IS NULL);

CREATE POLICY "Allow users to read their own feedback" ON public.feedback
    FOR SELECT USING (auth.uid()::text = user_id);

-- 5. Corrections Policies
CREATE POLICY "Allow users to insert corrections" ON public.corrections
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

CREATE POLICY "Allow users to read their own corrections" ON public.corrections
    FOR SELECT USING (auth.uid()::text = user_id);

-- 6. Learning Memory Policies (Read-only for all authenticated users, write for admin)
CREATE POLICY "Allow public read of verified learning memory" ON public.verified_learning_memory
    FOR SELECT USING (true);

-- 7. Scan Learning Logs Policies
CREATE POLICY "Allow users to insert their own logs" ON public.scan_learning_logs
    FOR INSERT WITH CHECK (auth.uid()::text = user_id);

-- Profile Trigger for Auth Sync
-- Automatically creates a profile record in the public schema when a user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', 'user');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
