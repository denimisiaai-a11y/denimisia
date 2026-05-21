'use client';

import { usePathname } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';
import { useChatStore } from './use-chat-store';
import { ChatPanel } from './chat-panel';

export function ChatBubble() {
  const pathname = usePathname();
  const open = useChatStore((s) => s.open);
  const setOpen = useChatStore((s) => s.setOpen);

  // Hide on checkout — we don't want the bubble competing with payment focus.
  if (pathname?.startsWith('/checkout')) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label={open ? 'Close product finder' : 'Open product finder'}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-paper shadow-lg transition-transform hover:scale-105"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
      {open ? <ChatPanel /> : null}
    </>
  );
}
