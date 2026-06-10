-- Enforce at-least-one-owner integrity on Return rows.
-- Mirrors the Order_owner_check pattern from guest_checkout_support migration.
ALTER TABLE "Return" ADD CONSTRAINT "Return_owner_check" CHECK (
  "orderId" IS NOT NULL
  OR "userId" IS NOT NULL
  OR ("guestEmail" IS NOT NULL AND "guestPhone" IS NOT NULL)
);
