import { ComingSoon } from '@/components/coming-soon';

export default function FacebookConnectorPage() {
  return (
    <ComingSoon
      title="Facebook Connector"
      description="Sync the catalog to Facebook & Instagram Shops, fire the Pixel, and track conversions from the source."
      breadcrumbs={[{ label: 'Marketing' }, { label: 'Facebook Connector' }]}
      icon="hub"
      status="Backend Required"
      featureList={[
        'One-click catalog feed to Meta Commerce Manager',
        'Pixel ID management and CAPI (Conversions API) token storage',
        'Event mapping — ViewContent, AddToCart, Purchase with match keys',
        'Instagram Shop product tagging',
        'Custom audience generation from cart abandoners',
        'Ad spend vs attributed revenue attribution overview',
      ]}
    />
  );
}
