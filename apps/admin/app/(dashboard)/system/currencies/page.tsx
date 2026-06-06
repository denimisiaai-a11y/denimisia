import { ComingSoon } from '@/components/coming-soon';

export default function CurrenciesPage() {
  return (
    <ComingSoon
      title="Currencies"
      description="Accept multiple currencies with live exchange rates and per-currency pricing overrides."
      breadcrumbs={[{ label: 'System' }, { label: 'Currencies' }]}
      icon="currency_exchange"
      status="Backend Required"
      featureList={[
        'Set primary currency (default: BDT)',
        'Enable additional display currencies — USD, EUR, INR',
        'Auto-refresh FX rates every 24 hours',
        'Per-product currency overrides for markets where floor price matters',
        'Checkout-level currency selection',
        'Revenue reporting normalized to primary currency',
      ]}
    />
  );
}
