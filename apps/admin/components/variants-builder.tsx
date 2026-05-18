'use client';

import { ImageUploader } from './image-uploader';

// Variant matrix builder. Full (color × size) matrix:
//  - Each color has its own list of sizes
//  - Each (color, size) pair has its own stock count
// On product create, every entry becomes one CreateVariantDto row with an
// auto-generated SKU. The template `sizes` field just seeds new colors so
// the admin doesn't have to retype S/M/L for every color.

export interface SizeEntry {
  /** Stable id for React keys. */
  id: string;
  /** Size label as shown to the customer: "S", "M", "30", etc. */
  label: string;
  stock: number;
}

export interface ColorEntry {
  /** Stable id so React keys + image uploaders don't lose state on reorder. */
  id: string;
  name: string;
  images: string[];
  /**
   * Optional hex (e.g. "#1B1B1B"). Used as the swatch fallback when the
   * color has no uploaded images yet. The storefront's selector prefers
   * variant images; this is a nicety so the admin can preview "Olive" as
   * an actual olive dot before photos are added.
   */
  hex?: string;
  /** Per-color size list. Each size has its own stock. */
  sizes: SizeEntry[];
}

export interface VariantsBuilderValue {
  colors: ColorEntry[];
}

interface VariantsBuilderProps {
  value: VariantsBuilderValue;
  onChange: (next: VariantsBuilderValue) => void;
  token: string | undefined;
  /**
   * Size labels used to pre-fill a new color when "+ Add color" is clicked.
   * Typically the Main Variant's size labels so additional colors inherit
   * the same size set with stocks defaulted to 0. Falls back to one blank
   * size row when empty.
   */
  seedSizes?: string[];
}

export function VariantsBuilder({
  value,
  onChange,
  token,
  seedSizes = [],
}: VariantsBuilderProps) {
  const { colors } = value;

  const update = (patch: Partial<VariantsBuilderValue>) => {
    onChange({ ...value, ...patch });
  };

  const seedSizeEntries = (): SizeEntry[] => {
    if (seedSizes.length === 0) {
      return [{ id: crypto.randomUUID(), label: '', stock: 0 }];
    }
    return seedSizes.map((label) => ({
      id: crypto.randomUUID(),
      label,
      stock: 0,
    }));
  };

  const addColor = () => {
    update({
      colors: [
        ...colors,
        {
          id: crypto.randomUUID(),
          name: '',
          images: [],
          hex: '',
          sizes: seedSizeEntries(),
        },
      ],
    });
  };

  const updateColor = (id: string, patch: Partial<ColorEntry>) => {
    update({
      colors: colors.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    });
  };

  const removeColor = (id: string) => {
    update({ colors: colors.filter((c) => c.id !== id) });
  };

  const addSize = (colorId: string) => {
    updateColor(colorId, {
      sizes: [
        ...(colors.find((c) => c.id === colorId)?.sizes ?? []),
        { id: crypto.randomUUID(), label: '', stock: 0 },
      ],
    });
  };

  const updateSize = (
    colorId: string,
    sizeId: string,
    patch: Partial<SizeEntry>,
  ) => {
    const color = colors.find((c) => c.id === colorId);
    if (!color) return;
    updateColor(colorId, {
      sizes: color.sizes.map((s) => (s.id === sizeId ? { ...s, ...patch } : s)),
    });
  };

  const removeSize = (colorId: string, sizeId: string) => {
    const color = colors.find((c) => c.id === colorId);
    if (!color) return;
    updateColor(colorId, {
      sizes: color.sizes.filter((s) => s.id !== sizeId),
    });
  };

  const colorList = colors.filter(
    (c) => c.name.trim().length > 0 && c.sizes.some((s) => s.label.trim()),
  );
  const totalVariants = colorList.reduce(
    (sum, c) => sum + c.sizes.filter((s) => s.label.trim()).length,
    0,
  );
  const totalUnits = colorList.reduce(
    (sum, c) =>
      sum +
      c.sizes
        .filter((s) => s.label.trim())
        .reduce((s, sz) => s + sz.stock, 0),
    0,
  );

  return (
    <section className="bg-surface-container-lowest p-8 shadow-[0_20px_40px_rgba(27,28,28,0.03)]">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-secondary">
            IV · Additional Variants
          </p>
          <p className="mt-1 text-[10px] tracking-wide text-secondary normal-case">
            Optional. Add more colors or sizes beyond the main variant.
          </p>
        </div>
        <span
          className="material-symbols-outlined text-secondary"
          aria-hidden
        >
          tune
        </span>
      </header>

      {/* Colors */}
      <div className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
            Colors
          </p>
          <button
            type="button"
            onClick={addColor}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-on-surface hover:text-primary transition-colors duration-300 ease-editorial"
          >
            <span
              className="material-symbols-outlined text-sm"
              aria-hidden
            >
              add
            </span>
            Add color
          </button>
        </div>

        {colors.length === 0 ? (
          <p className="text-xs text-secondary border border-dashed border-outline-variant/30 py-6 px-4 text-center">
            No additional variants. The main variant from section III is
            already purchasable on its own — only add here if this product
            also comes in other colors or sizes.
          </p>
        ) : (
          <div className="space-y-4">
            {colors.map((color, idx) => {
              const firstImage = color.images[0];
              const swatchHex = isValidHex(color.hex) ? color.hex : undefined;
              return (
                <div
                  key={color.id}
                  className="border border-outline-variant/15 bg-surface-container/40 p-4"
                >
                  <div className="mb-3 flex items-center gap-3">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-secondary w-6">
                      {String(idx + 1).padStart(2, '0')}
                    </span>

                    {/* Circular swatch preview — image wins, hex fallback,
                        neutral checker if neither set yet. Same visual the
                        customer sees on the product detail page. */}
                    <ColorSwatchPreview
                      imageSrc={firstImage}
                      hex={swatchHex}
                      label={color.name || 'New color'}
                    />

                    <input
                      type="text"
                      value={color.name}
                      onChange={(e) =>
                        updateColor(color.id, { name: e.target.value })
                      }
                      placeholder="e.g. Black, Olive, Off White"
                      className="flex-1 border-0 border-b border-outline-variant/25 bg-transparent py-2 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                    />

                    {/* Hex input is optional — only matters when there are no
                        photos for this color (e.g. accessories, swatch cards). */}
                    <label
                      className="inline-flex items-center gap-1.5"
                      title="Optional hex color (used as swatch when there are no photos)"
                    >
                      <input
                        type="color"
                        value={swatchHex ?? '#cccccc'}
                        onChange={(e) =>
                          updateColor(color.id, { hex: e.target.value })
                        }
                        className="h-7 w-7 cursor-pointer rounded-full border border-outline-variant/30 bg-transparent p-0"
                        aria-label="Pick hex color"
                      />
                      <input
                        type="text"
                        value={color.hex ?? ''}
                        onChange={(e) =>
                          updateColor(color.id, { hex: e.target.value })
                        }
                        placeholder="#1B1B1B"
                        maxLength={7}
                        className="w-20 border-0 border-b border-outline-variant/25 bg-transparent py-1 text-xs text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0 font-mono"
                      />
                    </label>

                    <button
                      type="button"
                      onClick={() => removeColor(color.id)}
                      aria-label={`Remove ${color.name || 'color'}`}
                      className="h-8 w-8 inline-flex items-center justify-center text-secondary hover:text-error transition-colors"
                    >
                      <span
                        className="material-symbols-outlined text-base"
                        aria-hidden
                      >
                        close
                      </span>
                    </button>
                  </div>

                  <div className="ml-9 space-y-6">
                    <div>
                      <p className="text-[10px] tracking-wide text-secondary mb-2">
                        Photos for {color.name.trim() || 'this color'} (optional).
                        Falls back to general product images on the storefront.
                      </p>
                      <ImageUploader
                        value={color.images}
                        onChange={(images) => updateColor(color.id, { images })}
                        token={token}
                        folder="products"
                        maxFiles={6}
                      />
                    </div>

                    {/* Per-size stock grid for this color. Each row is one
                        size label + its own stock count. Add/remove freely;
                        an empty label row is silently skipped at submit. */}
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                          Sizes &amp; stock
                        </p>
                        <button
                          type="button"
                          onClick={() => addSize(color.id)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface hover:text-primary transition-colors"
                        >
                          <span
                            className="material-symbols-outlined text-sm"
                            aria-hidden
                          >
                            add
                          </span>
                          Add size
                        </button>
                      </div>

                      {color.sizes.length === 0 ? (
                        <p className="text-[11px] text-secondary border border-dashed border-outline-variant/30 py-4 px-3 text-center">
                          No sizes for this color yet. Add at least one to make
                          it purchasable.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {/* Column header — makes the field roles obvious
                              even when rows are empty. */}
                          <div className="grid grid-cols-[1fr_1fr_auto] gap-3 px-3 pb-1">
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                              Size
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
                              Stock
                            </span>
                            <span className="w-6" aria-hidden />
                          </div>

                          {color.sizes.map((sz, sizeIdx) => (
                            <div
                              key={sz.id}
                              className="grid grid-cols-[1fr_1fr_auto] items-center gap-3 border border-outline-variant/20 bg-surface-container/30 px-3 py-2"
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-secondary w-6">
                                  {String(sizeIdx + 1).padStart(2, '0')}
                                </span>
                                <input
                                  type="text"
                                  value={sz.label}
                                  onChange={(e) =>
                                    updateSize(color.id, sz.id, {
                                      label: e.target.value,
                                    })
                                  }
                                  placeholder="e.g. 28 or M"
                                  aria-label={`Size label ${sizeIdx + 1}`}
                                  className="flex-1 border-0 border-b border-outline-variant/25 bg-transparent py-1 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                                />
                              </div>

                              <input
                                type="number"
                                min={0}
                                step={1}
                                value={sz.stock}
                                onChange={(e) =>
                                  updateSize(color.id, sz.id, {
                                    stock: Math.max(
                                      0,
                                      parseInt(e.target.value || '0', 10),
                                    ),
                                  })
                                }
                                placeholder="0"
                                aria-label={`Stock for size ${sz.label || 'unnamed'}`}
                                className="w-full border-0 border-b border-outline-variant/25 bg-transparent py-1 text-sm text-on-surface placeholder:text-secondary focus:border-primary focus:outline-none focus:ring-0"
                              />

                              <button
                                type="button"
                                onClick={() => removeSize(color.id, sz.id)}
                                aria-label={`Remove size ${sz.label || 'unnamed'}`}
                                className="h-6 w-6 inline-flex items-center justify-center text-secondary hover:text-error transition-colors"
                              >
                                <span
                                  className="material-symbols-outlined text-sm"
                                  aria-hidden
                                >
                                  close
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Preview */}
      {totalVariants > 0 ? (
        <p className="mt-6 text-[10px] tracking-wide text-secondary">
          Will create{' '}
          <span className="font-bold text-on-surface">
            {totalVariants} variant{totalVariants === 1 ? '' : 's'}
          </span>{' '}
          across{' '}
          <span className="font-bold text-on-surface">
            {colorList.length} color{colorList.length === 1 ? '' : 's'}
          </span>{' '}
          ·{' '}
          <span className="font-bold text-on-surface">{totalUnits}</span>{' '}
          total units at launch.
        </p>
      ) : (
        <p className="mt-6 text-[10px] tracking-wide text-secondary">
          Add at least one color with one size to generate purchasable variants.
        </p>
      )}
    </section>
  );
}

function isValidHex(value: string | undefined): value is string {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

interface ColorSwatchPreviewProps {
  imageSrc: string | undefined;
  hex: string | undefined;
  label: string;
}

function ColorSwatchPreview({ imageSrc, hex, label }: ColorSwatchPreviewProps) {
  const base =
    'relative h-10 w-10 flex-shrink-0 rounded-full border border-outline-variant/30 overflow-hidden';
  if (imageSrc) {
    return (
      // Plain <img> here on purpose — the admin form doesn't need Next/Image's
      // CDN optimization for a 40px preview, and it sidesteps remotePatterns
      // config for arbitrary R2 URLs.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageSrc}
        alt={`${label} swatch`}
        className={`${base} object-cover`}
      />
    );
  }
  if (hex) {
    return (
      <span
        aria-label={`${label} swatch`}
        className={base}
        style={{ backgroundColor: hex }}
      />
    );
  }
  return (
    <span
      aria-label="No swatch set"
      className={`${base} bg-[conic-gradient(at_50%_50%,_#e5e5e5_0deg,_#fafafa_90deg,_#e5e5e5_180deg,_#fafafa_270deg)]`}
    />
  );
}

/**
 * Walks each color's own size list and emits one CreateVariantDto row per
 * (color, size) pair. Empty-label sizes are skipped. SKU format:
 * `{slugUpper4}-{colorCode3}-{sizeCode}` — collisions are rare with this
 * format, but the API rejects duplicate SKUs anyway so the worst case is a
 * clear validation error.
 */
export function buildVariantsFromBuilder(
  product: { slug: string },
  builder: VariantsBuilderValue,
): {
  sku: string;
  size: string;
  color: string;
  colorHex?: string;
  stock: number;
  images?: string[];
}[] {
  const colorList = builder.colors.filter(
    (c) => c.name.trim().length > 0 && c.sizes.some((s) => s.label.trim()),
  );
  if (colorList.length === 0) return [];

  const slugCode = product.slug
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(2, 'X');

  return colorList.flatMap((color) => {
    const colorCode = color.name
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 3)
      .padEnd(2, 'X');
    return color.sizes
      .filter((s) => s.label.trim().length > 0)
      .map((sz) => {
        const sizeCode = sz.label.replace(/[^A-Za-z0-9]/g, '');
        return {
          sku: `${slugCode}-${colorCode}-${sizeCode}`,
          size: sz.label.trim(),
          color: color.name.trim(),
          ...(color.hex && color.hex.trim()
            ? { colorHex: color.hex.trim() }
            : {}),
          stock: sz.stock,
          ...(color.images.length > 0 ? { images: color.images } : {}),
        };
      });
  });
}
