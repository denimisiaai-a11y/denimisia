import { ANNOUNCEMENT_MESSAGES } from '@/lib/constants';

interface AnnouncementBarProps {
  visible: boolean;
}

export function AnnouncementBar({ visible }: AnnouncementBarProps) {
  return (
    <div
      className={`overflow-hidden whitespace-nowrap border-b border-white/10 bg-ink text-paper transition-all duration-300 ${
        visible ? 'h-9 py-2.5 opacity-100' : 'h-0 opacity-0'
      }`}
    >
      <div className="animate-marquee flex w-max">
        <MarqueeRow />
        <MarqueeRow />
      </div>
    </div>
  );
}

function MarqueeRow() {
  return (
    <div className="flex shrink-0 gap-12 px-6">
      {ANNOUNCEMENT_MESSAGES.map((msg) => (
        <span
          key={msg}
          className="text-[0.65rem] font-medium uppercase tracking-[0.25em]"
        >
          {msg}
        </span>
      ))}
    </div>
  );
}
