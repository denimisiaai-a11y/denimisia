'use client';

import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';
import { useEffect, useState } from 'react';

interface RichTextEditorProps {
  readonly value: string;
  readonly onChange: (html: string) => void;
  readonly placeholder?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = 'Describe the product…',
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Heading levels we expose — h1 is the product title in the page
        // template so we cap at h2 for sub-headings within the description.
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          rel: 'noopener noreferrer',
          target: '_blank',
        },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: value,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        // Light "prose" replica so the editor surface looks the same as the
        // public-facing description on the storefront.
        class:
          'min-h-[180px] w-full bg-surface-container px-4 py-3 text-sm leading-relaxed text-on-surface focus:outline-none ' +
          '[&_h2]:mt-4 [&_h2]:mb-2 [&_h2]:font-headline [&_h2]:text-lg [&_h2]:font-semibold ' +
          '[&_h3]:mt-3 [&_h3]:mb-1 [&_h3]:font-headline [&_h3]:text-base [&_h3]:font-semibold ' +
          '[&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-2 ' +
          '[&_a]:underline [&_a]:text-primary [&_blockquote]:border-l-2 [&_blockquote]:border-outline-variant ' +
          '[&_blockquote]:pl-3 [&_blockquote]:italic [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)] ' +
          '[&_p.is-editor-empty:first-child]:before:text-secondary [&_p.is-editor-empty:first-child]:before:float-left ' +
          '[&_p.is-editor-empty:first-child]:before:pointer-events-none',
      },
    },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      // TipTap returns `<p></p>` for an empty doc — normalise to '' so the
      // backend doesn't store noise that renders as a phantom paragraph.
      onChange(html === '<p></p>' ? '' : html);
    },
  });

  // Sync external `value` changes (e.g. when the product loads asynchronously)
  // into the editor without breaking the user's cursor for normal typing.
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const incoming = value || '<p></p>';
    if (current !== incoming && !editor.isFocused) {
      editor.commands.setContent(incoming, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) {
    return (
      <div className="min-h-[180px] w-full animate-pulse bg-surface-container" />
    );
  }

  return (
    <div className="border border-outline-variant/30">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

interface ToolbarProps {
  readonly editor: Editor;
}

function Toolbar({ editor }: ToolbarProps) {
  const [, setRerender] = useState(0);

  // TipTap's `editor.isActive(...)` and command results change after every
  // selection / keystroke. The component itself doesn't re-render on those,
  // so subscribe to the editor's `selectionUpdate` and `transaction` events
  // and bump local state to refresh the toolbar's active-state highlighting.
  useEffect(() => {
    const refresh = () => setRerender((n) => n + 1);
    editor.on('selectionUpdate', refresh);
    editor.on('transaction', refresh);
    return () => {
      editor.off('selectionUpdate', refresh);
      editor.off('transaction', refresh);
    };
  }, [editor]);

  const promptLink = () => {
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('Link URL (leave blank to remove)', previous ?? '');
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-outline-variant/20 bg-surface-container-low px-2 py-1.5">
      <Btn label="B" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold (Ctrl+B)" bold />
      <Btn label="I" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic (Ctrl+I)" italic />
      <Btn label="S" active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough" strike />
      <Divider />
      <Btn label="H2" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2" />
      <Btn label="H3" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3" />
      <Btn label="¶" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()} title="Paragraph" />
      <Divider />
      <Btn label="• List" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list" />
      <Btn label="1. List" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list" />
      <Btn label="❝" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote" />
      <Divider />
      <Btn label="Link" active={editor.isActive('link')} onClick={promptLink} title="Insert / edit link" />
      <Btn label="─" onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule" />
      <Divider />
      <Btn label="↶" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo (Ctrl+Z)" />
      <Btn label="↷" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo (Ctrl+Shift+Z)" />
      <Divider />
      <Btn label="Clear" onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()} title="Strip all formatting from selection" />
    </div>
  );
}

interface BtnProps {
  readonly label: string;
  readonly title: string;
  readonly active?: boolean;
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly strike?: boolean;
}

function Btn({ label, title, active, disabled, onClick, bold, italic, strike }: BtnProps) {
  const stateCls = active
    ? 'bg-on-surface text-surface'
    : 'text-on-surface hover:bg-surface-container';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={
        'rounded px-2 py-1 text-xs transition-colors disabled:opacity-30 disabled:cursor-not-allowed ' +
        (bold ? 'font-bold ' : '') +
        (italic ? 'italic ' : '') +
        (strike ? 'line-through ' : '') +
        stateCls
      }
    >
      {label}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-outline-variant/30" aria-hidden />;
}
