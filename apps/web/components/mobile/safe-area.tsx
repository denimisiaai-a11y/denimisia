type Edge = 'top' | 'bottom' | 'left' | 'right';

interface SafeAreaProps {
  edge: Edge;
  className?: string;
}

const VAR: Record<Edge, string> = {
  top: 'var(--safe-top)',
  bottom: 'var(--safe-bottom)',
  left: 'var(--safe-left)',
  right: 'var(--safe-right)',
};

const STYLE: Record<Edge, 'height' | 'width'> = {
  top: 'height',
  bottom: 'height',
  left: 'width',
  right: 'width',
};

export function SafeArea({ edge, className }: SafeAreaProps) {
  return (
    <div
      aria-hidden
      className={className}
      style={{ [STYLE[edge]]: VAR[edge] }}
    />
  );
}
