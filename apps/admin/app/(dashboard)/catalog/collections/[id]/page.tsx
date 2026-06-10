import { EditorShell } from './editor-shell';

export default async function CollectionEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <EditorShell collectionId={id} />;
}
