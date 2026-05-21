import { SilhouetteEditorClient } from './silhouette-editor-client';

export default function SilhouetteSettingsPage() {
  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-lg font-semibold">Silhouettes</h1>
        <p className="text-sm text-secondary mt-1">
          Configure the body silhouettes used in the customer-facing Size &amp;
          Fit modal. Drag the red pins to set landmark positions for each
          anatomy point.
        </p>
      </header>
      <SilhouetteEditorClient />
    </div>
  );
}
