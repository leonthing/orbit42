-- Link a contact to an orbit42 member (matched by email) so a scanned/synced
-- card can become a follow + time-booking entry point, not just dead info.
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS linked_user_id uuid REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_linked_user
  ON contacts(linked_user_id)
  WHERE linked_user_id IS NOT NULL;
