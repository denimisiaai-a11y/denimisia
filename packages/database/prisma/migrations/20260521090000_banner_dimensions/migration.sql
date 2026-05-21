-- Banner: fine-grained width/height per device + image fit mode.
ALTER TABLE "Banner"
  ADD COLUMN "popupWidthPct"        INTEGER NOT NULL DEFAULT 95,
  ADD COLUMN "popupHeightPct"       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "popupWidthPctMobile"  INTEGER NOT NULL DEFAULT 95,
  ADD COLUMN "popupHeightPctMobile" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "imageFit"             TEXT    NOT NULL DEFAULT 'cover';
