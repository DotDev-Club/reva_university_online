-- Migration 005: Make subjects.semester nullable
-- Semester placement is now tracked in scheme_subjects.
-- The semester column on subjects is legacy and no longer required for new imports.

ALTER TABLE subjects ALTER COLUMN semester DROP NOT NULL;
