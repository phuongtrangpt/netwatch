ALTER TABLE projects ADD COLUMN vendor TEXT NOT NULL DEFAULT 'mikrotik' CHECK(vendor IN ('mikrotik','nec'));
