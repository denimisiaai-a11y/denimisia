export const PRODUCT_TYPES = ['PANTS', 'SHIRTS', 'JACKETS'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

export const UNIVERSAL_ATTRIBUTES = {
  season: {
    required: true,
    multi: true,
    options: ['Summer', 'Winter', 'Spring/Fall', 'All-season'],
  },
  occasion: {
    required: false,
    multi: true,
    options: ['Casual', 'Smart casual', 'Formal', 'Workwear', 'Party'],
  },
  material: {
    required: true,
    multi: true,
    options: [
      'Cotton',
      'Denim',
      'Linen',
      'Leather',
      'Wool',
      'Polyester',
      'Blend',
      'Stretch',
    ],
  },
  pattern: {
    required: false,
    multi: false,
    options: ['Solid', 'Striped', 'Checked', 'Printed', 'Graphic', 'Distressed'],
  },
} as const;

export const TYPE_ATTRIBUTES: Record<
  ProductType,
  Record<string, { required: boolean; multi: boolean; options: readonly string[] }>
> = {
  PANTS: {
    silhouette: {
      required: true,
      multi: true,
      options: [
        'Skinny',
        'Slim',
        'Straight',
        'Relaxed',
        'Baggy',
        'Wide-leg',
        'Bootcut',
        'Flared',
      ],
    },
    rise: { required: true, multi: false, options: ['Low', 'Mid', 'High'] },
    length: { required: false, multi: false, options: ['Full', 'Cropped', 'Ankle'] },
    wash: {
      required: false,
      multi: false,
      options: ['Raw', 'Dark', 'Mid', 'Light', 'Black', 'Distressed', 'Acid'],
    },
  },
  SHIRTS: {
    silhouette: {
      required: true,
      multi: true,
      options: ['Slim', 'Fitted', 'Regular', 'Relaxed', 'Baggy', 'Oversized', 'Cropped'],
    },
    sleeve: {
      required: true,
      multi: false,
      options: ['Sleeveless', 'Short', '3/4', 'Long'],
    },
    neckline: {
      required: true,
      multi: false,
      options: ['Crew', 'V-neck', 'Polo', 'Button-up', 'Henley', 'Mock-neck'],
    },
    length: {
      required: false,
      multi: false,
      options: ['Regular', 'Cropped', 'Tunic'],
    },
  },
  JACKETS: {
    silhouette: {
      required: true,
      multi: true,
      options: ['Cropped', 'Fitted', 'Regular', 'Oversized'],
    },
    length: {
      required: true,
      multi: false,
      options: ['Cropped', 'Hip-length', 'Mid-length', 'Long'],
    },
    closure: {
      required: true,
      multi: false,
      options: ['Zip', 'Button', 'Snap', 'Open/drape'],
    },
    warmth: {
      required: true,
      multi: false,
      options: ['Light', 'Medium', 'Heavy'],
    },
  },
};

export const SIZE_CHART_DIMENSIONS: Record<ProductType, readonly string[]> = {
  PANTS: ['waist', 'hip', 'inseam', 'thigh', 'front rise', 'back rise', 'hem opening', 'waistband height'],
  SHIRTS: ['chest', 'shoulder', 'length', 'sleeve', 'bicep', 'hem opening', 'neck width', 'cuff opening', 'armhole depth'],
  JACKETS: ['chest', 'shoulder', 'length', 'sleeve', 'bicep', 'hem opening', 'cuff opening', 'back length', 'armhole depth'],
};
