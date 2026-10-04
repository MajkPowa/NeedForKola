ALTER TABLE orders ADD COLUMN terms_snapshot TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(terms_snapshot));
CREATE TRIGGER protect_terms_snapshot BEFORE UPDATE OF terms_snapshot ON orders BEGIN SELECT RAISE(ABORT,'IMMUTABLE_TERMS'); END;
