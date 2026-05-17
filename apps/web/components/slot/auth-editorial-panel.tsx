import Image from 'next/image';
import { AUTH_EDITORIAL } from '@/lib/placeholder-images';
import { fetchPageSlots, pickSlot, resolveSlotUrl } from '@/lib/page-slots';

/**
 * Shared editorial side panel used by /login, /register, /forgot-password,
 * /reset-password. Server component so the slot can be read at render time
 * and swapped by the admin without the client having to re-fetch.
 */
export async function AuthEditorialPanel() {
  const slots = await fetchPageSlots('auth');
  const slot  = pickSlot(slots, 'auth_editorial_panel');
  const { src, kind, poster } = resolveSlotUrl(slot, AUTH_EDITORIAL);

  return (
    <section
      data-slot="auth.auth_editorial_panel"
      className="relative hidden h-full overflow-hidden bg-[#3c3b38] md:block md:w-1/2 lg:w-3/5"
    >
      {kind === 'VIDEO' ? (
        <video
          data-slot-field="media"
          src={src}
          poster={poster ?? undefined}
          autoPlay
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <Image
          data-slot-field="media"
          src={src}
          alt={slot?.altText ?? 'Editorial denim photography'}
          fill
          priority
          className="object-cover"
          sizes="(max-width: 768px) 0vw, 50vw"
        />
      )}
    </section>
  );
}
