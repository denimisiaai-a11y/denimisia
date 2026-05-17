'use client';

import type { FacetsResponse } from '@/lib/api';
import { BottomSheet } from '@/components/mobile/bottom-sheet';
import { CollectionFilters } from './collection-filters';

interface MobileFilterDrawerProps {
  open: boolean;
  onClose: () => void;
  facets: FacetsResponse;
}

export function MobileFilterDrawer({ open, onClose, facets }: MobileFilterDrawerProps) {
  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => (o ? null : onClose())}
      title="Filters"
    >
      <CollectionFilters facets={facets} onClose={onClose} />
    </BottomSheet>
  );
}
