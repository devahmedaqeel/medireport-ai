-- MediReport AI: Universal Supabase Schema

-- 1. Profiles: User roles and basic info
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email TEXT UNIQUE,
    full_name TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('user', 'admin', 'doctor')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Reports: High-level scan metadata
CREATE TABLE IF NOT EXISTS reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
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

-- 3. Observations: Detailed marker extractions
CREATE TABLE IF NOT EXISTS observations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
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

-- 4. Learning Memory (Verified)
CREATE TABLE IF NOT EXISTS verified_learning_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_type TEXT CHECK (memory_type IN ('alias', 'ocr_correction', 'layout', 'rule')),
    key TEXT,
    value JSONB,
    source TEXT,
    confidence NUMERIC,
    validation_status TEXT DEFAULT 'verified',
    approved_by UUID REFERENCES profiles(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Pending Corrections: Feedback loop
CREATE TABLE IF NOT EXISTS pending_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES profiles(id),
    report_id UUID REFERENCES reports(id),
    correction_type TEXT,
    original_value TEXT,
    corrected_value TEXT,
    context JSONB,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    admin_note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);

-- 6. Model Accuracy History
CREATE TABLE IF NOT EXISTS model_accuracy_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_version TEXT,
    dataset_size INTEGER,
    report_type_accuracy NUMERIC,
    extraction_accuracy NUMERIC,
    value_accuracy NUMERIC,
    status_accuracy NUMERIC,
    overall_accuracy NUMERIC,
    failed_cases JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Parser Training Examples (Verified Data)
CREATE TABLE IF NOT EXISTS parser_training_examples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_type TEXT,
    category TEXT,
    input_text TEXT,
    expected_output JSONB,
    source TEXT,
    verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE observations ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_corrections ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for setup)
CREATE POLICY "Users can see their own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can see their own reports" ON reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own reports" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);
