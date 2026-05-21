-- DropTable: removes the BlogPost feature entirely.
-- Drops the table along with its indexes and FK constraint (BlogPost.authorId -> User.id).
DROP TABLE IF EXISTS "BlogPost";
