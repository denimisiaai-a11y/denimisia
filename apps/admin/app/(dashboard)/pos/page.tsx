import { ComingSoon } from '@/components/coming-soon';

export default function POSPage() {
  return (
    <ComingSoon
      title="Point of Sale"
      description="In-store checkout — scan, sell, and reconcile online + offline inventory in one ledger."
      breadcrumbs={[{ label: 'Sales' }, { label: 'Point of Sale' }]}
      icon="point_of_sale"
      status="Backend Required"
      featureList={[
        'Fast product search with barcode scan + manual SKU lookup',
        'Cart with quantity, discount, and variant picker',
        'Payment split — cash, card (via partner terminal), mobile financial services',
        'Receipt print to attached thermal printer',
        'Walk-in customer lookup and loyalty point accrual',
        'End-of-day register reconciliation report',
        'Unified inventory with online store — a sale anywhere decrements stock everywhere',
      ]}
    />
  );
}
