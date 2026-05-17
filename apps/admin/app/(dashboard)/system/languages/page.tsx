import { ComingSoon } from '@/components/coming-soon';

export default function LanguagesPage() {
  return (
    <ComingSoon
      title="Languages"
      description="Multi-lingual storefront — Bengali, English, and beyond."
      breadcrumbs={[{ label: 'System' }, { label: 'Languages' }]}
      icon="translate"
      status="Backend Required"
      featureList={[
        'Enable/disable locales with a switch',
        'Per-locale product name, description, and slug translations',
        'Storefront language toggle in the header',
        'URL-based locale routing (/en, /bn)',
        'Translation status dashboard — coverage per language',
        'Import/export translation strings via CSV',
      ]}
    />
  );
}
