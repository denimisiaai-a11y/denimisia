'use client';

interface SalesPoint {
  readonly date: string;
  readonly orders: number;
  readonly customers: number;
  readonly revenue: number;
}

interface SalesChartProps {
  readonly data: readonly SalesPoint[];
  readonly height?: number;
  readonly rangeLabel?: string;
}

const CHART_WIDTH = 1000;

export function SalesChart({ data, height = 260, rangeLabel = 'Sales' }: SalesChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center bg-surface-container-low font-body text-xs uppercase tracking-[0.2em] text-secondary"
        style={{ height }}
      >
        No data in range
      </div>
    );
  }

  const padX = 36;
  const padTop = 20;
  const padBottom = 28;
  const innerHeight = height - padTop - padBottom;
  const maxOrders = Math.max(1, ...data.map((d) => d.orders));
  const maxCustomers = Math.max(1, ...data.map((d) => d.customers));
  const yMax = Math.ceil(Math.max(maxOrders, maxCustomers) * 1.15);

  const stepX = (CHART_WIDTH - padX * 2) / Math.max(1, data.length - 1);
  const barWidth = Math.max(6, Math.min(22, stepX * 0.55));

  const yFor = (v: number) => padTop + innerHeight - (v / yMax) * innerHeight;
  const xFor = (i: number) => padX + i * stepX;

  const gridLines = 4;
  const gridValues = Array.from({ length: gridLines + 1 }, (_, i) =>
    Math.round((yMax * i) / gridLines),
  );

  // Sparse labels — pick about 8 evenly spaced days
  const labelStep = Math.max(1, Math.floor(data.length / 8));

  return (
    <div className="w-full">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-5">
          <LegendDot color="#c7d8ee" label="Orders" />
          <LegendDot color="#2f5f97" label="Customers" />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary">
          {rangeLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
        role="img"
        aria-label="Sales analytics chart"
      >
        {gridValues.map((g, idx) => {
          const y = yFor(g);
          return (
            <g key={`grid-${idx}-${g}`}>
              <line
                x1={padX}
                x2={CHART_WIDTH - padX}
                y1={y}
                y2={y}
                stroke="currentColor"
                strokeOpacity={0.08}
                strokeDasharray="2 4"
              />
              <text
                x={padX - 6}
                y={y + 3}
                fontSize={9}
                textAnchor="end"
                fill="currentColor"
                opacity={0.4}
                fontFamily="var(--font-body)"
              >
                {g}
              </text>
            </g>
          );
        })}

        {data.map((point, i) => {
          const x = xFor(i);
          const ordersY = yFor(point.orders);
          const customersY = yFor(point.customers);
          return (
            <g key={point.date}>
              <rect
                x={x - barWidth / 2}
                y={ordersY}
                width={barWidth}
                height={Math.max(0, padTop + innerHeight - ordersY)}
                fill="#c7d8ee"
                opacity={0.9}
              />
              <rect
                x={x - barWidth / 2 + barWidth * 0.2}
                y={customersY}
                width={barWidth * 0.6}
                height={Math.max(0, padTop + innerHeight - customersY)}
                fill="#2f5f97"
              />
              {i % labelStep === 0 && (
                <text
                  x={x}
                  y={height - 8}
                  fontSize={9}
                  textAnchor="middle"
                  fill="currentColor"
                  opacity={0.45}
                  fontFamily="var(--font-body)"
                >
                  {point.date.slice(8, 10)}
                </text>
              )}
            </g>
          );
        })}

        {/* Axis line */}
        <line
          x1={padX}
          x2={CHART_WIDTH - padX}
          y1={padTop + innerHeight}
          y2={padTop + innerHeight}
          stroke="currentColor"
          strokeOpacity={0.2}
        />
      </svg>
    </div>
  );
}

interface LegendDotProps {
  readonly color: string;
  readonly label: string;
}

function LegendDot({ color, label }: LegendDotProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: color }} />
      <span className="font-body text-[10px] uppercase tracking-[0.2em] text-secondary">
        {label}
      </span>
    </div>
  );
}
