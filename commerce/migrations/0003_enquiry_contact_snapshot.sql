ALTER TABLE enquiries ADD COLUMN contact_snapshot TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(contact_snapshot));
CREATE TRIGGER protect_enquiry_contact BEFORE UPDATE OF contact_snapshot ON enquiries BEGIN SELECT RAISE(ABORT,'IMMUTABLE_ENQUIRY_CONTACT'); END;
