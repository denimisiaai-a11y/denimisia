import { EditorShell } from './editor-shell';

export default function CollectionEditorPage({
  params,
}: {
  params: { id: string };
}) {
  return <EditorShell collectionId={params.id} />;
}
