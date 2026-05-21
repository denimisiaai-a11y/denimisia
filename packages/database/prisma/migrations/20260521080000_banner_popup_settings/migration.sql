-- Banner: per-banner popup presentation settings.
-- Defaults preserve the current shipped behaviour for any existing rows.
ALTER TABLE "Banner"
  ADD COLUMN "popupSize"       TEXT    NOT NULL DEFAULT 'large',
  ADD COLUMN "popupSizeMobile" TEXT    NOT NULL DEFAULT 'medium',
  ADD COLUMN "textOverlay"     BOOLEAN NOT NULL DEFAULT false;
