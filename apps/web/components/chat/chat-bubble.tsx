'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { MessageCircle, X } from 'lucide-react';
import { useChatStore } from './use-chat-store';
import { ChatPanel } from './chat-panel';

export function ChatBubble() {
  const pathname = usePathname();
  const search = useSearchParams();
  const open = useChatStore((s) => s.open);
  const setOpen = useChatStore((s) => s.setOpen);
  const setThreadActive = useChatStore((s) => s.setThreadActive);

  // Magic-link resume: /chat/resume/[token] verifies the token and redirects
  // here with ?chat=<id>&chatToken=<token>. Pick that up and restore the
  // thread without a round trip to the form.
  useEffect(() => {
    const chatId = search?.get('chat');
    const chatToken = search?.get('chatToken');
    if (chatId && chatToken) {
      setThreadActive(chatId, chatToken);
      setOpen(true);
    }
  }, [search, setThreadActive, setOpen]);

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
