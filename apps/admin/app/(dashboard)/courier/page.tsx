import { ComingSoon } from '@/components/coming-soon';

export default function CourierPage() {
  return (
    <ComingSoon
      title="Courier"
      description="Shipping zones, per-zone rates, courier integration, and tracking pickup schedules — all from one console."
      breadcrumbs={[{ label: 'Logistics' }, { label: 'Courier' }]}
      icon="local_shipping"
      status="Backend Required"
      featureList={[
        'Shipping zones by division, district, or postal prefix',
        'Per-zone flat and weight-based rates',
        'Courier partner integration — Pathao, Steadfast, RedX',
        'Auto-assignment rules based on destination and weight',
        'Bulk label printing and pickup scheduling',
        'Delivery performance analytics per courier',
      ]}
    />
  );
}
