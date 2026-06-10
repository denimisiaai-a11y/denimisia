import { WishlistClient } from './wishlist-client';

export default function WishlistPage() {
  return (
    <div>
      <h2 className="mb-6 text-lg font-medium uppercase tracking-[0.1em] text-ink">Wishlist</h2>
      <WishlistClient />
    </div>
  );
}
