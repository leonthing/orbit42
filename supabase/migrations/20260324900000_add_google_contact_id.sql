-- Add google_contact_id to contacts for sync deduplication
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS google_contact_id text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_google_id ON contacts(user_id, google_contact_id) WHERE google_contact_id IS NOT NULL;
