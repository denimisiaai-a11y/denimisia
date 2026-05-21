import { useCallback, useRef, useState } from 'react';
import type { GarmentOffsets } from './types';

interface DragHandleProps {
  cx: number;
  cy: number;
  onDelta: (deltaY: number) => void;
  ariaLabel: string;
}

export function DragHandle({ cx, cy, onDelta, ariaLabel }: DragHandleProps) {
  const startY = useRef<number | null>(null);
  const accumulatedDelta = useRef(0);
  const [active, setActive] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    (e.target as SVGCircleElement).setPointerCapture(e.pointerId);
    startY.current = e.clientY;
    accumulatedDelta.current = 0;
    setActive(true);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<SVGCircleElement>) => {
    if (startY.current === null) return;
    const delta = e.clientY - startY.current;
    accumulatedDelta.current = delta;
  }, []);

  const onPointerUp = useCallback(() => {
    if (startY.current === null) return;
    onDelta(accumulatedDelta.current);
    startY.current = null;
    setActive(false);
  }, [onDelta]);

  return (
    <circle
      cx={cx}
      cy={cy}
      r={active ? 6 : 5}
      fill="#fff"
      stroke="#c00"
      strokeWidth={2}
      style={{ cursor: 'ns-resize' }}
      role="slider"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}

interface DragHandleSetProps {
  topY: number;
  hemY: number;
  offsets: GarmentOffsets;
  onOffsetsChange: (next: GarmentOffsets) => void;
}

export function DragHandleSet({
  topY,
  hemY,
  offsets,
  onOffsetsChange,
}: DragHandleSetProps) {
  return (
    <>
      <DragHandle
        cx={100}
        cy={topY}
        ariaLabel="Adjust top edge"
        onDelta={(d) =>
          onOffsetsChange({ ...offsets, topY: (offsets.topY ?? 0) + d })
        }
      />
      <DragHandle
        cx={100}
        cy={hemY}
        ariaLabel="Adjust hem edge"
        onDelta={(d) =>
          onOffsetsChange({ ...offsets, hemY: (offsets.hemY ?? 0) + d })
        }
      />
    </>
  );
}
