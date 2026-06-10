export function SweaterDiagram() {
  return (
    <svg
      viewBox="0 0 380 400"
      className="mx-auto h-auto w-full max-w-[380px]"
      aria-label="Sweater flat measurement diagram"
    >
      <defs>
        <marker id="arrow-swtr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
        </marker>
      </defs>

      {/* Sweater outline — long sleeves */}
      <g stroke="#0a0a0a" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path d="M 125 70 L 55 260 L 95 280 L 125 170 L 125 340 L 255 340 L 255 170 L 285 280 L 325 260 L 255 70" />
        {/* Ribbed neck */}
        <path d="M 165 72 C 175 90, 205 90, 215 72" />
        <path d="M 168 80 C 178 96, 202 96, 212 80" />
        {/* Cuffs */}
        <path d="M 55 260 L 95 280" strokeWidth="1" />
        <path d="M 60 252 L 92 270" strokeWidth="1" />
        <path d="M 325 260 L 285 280" strokeWidth="1" />
        <path d="M 320 252 L 288 270" strokeWidth="1" />
        {/* Hem ribbing */}
        <path d="M 125 335 L 255 335" strokeWidth="1" />
      </g>

      {/* Full Length */}
      <line x1="190" y1="80" x2="190" y2="338" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-swtr)" markerEnd="url(#arrow-swtr)" />
      <text x="196" y="220" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em">
        FULL LENGTH
      </text>

      {/* Chest */}
      <line x1="130" y1="215" x2="250" y2="215" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-swtr)" markerEnd="url(#arrow-swtr)" />
      <text x="160" y="209" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em">
        CHEST
      </text>

      {/* Shoulder */}
      <line x1="125" y1="55" x2="255" y2="55" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-swtr)" markerEnd="url(#arrow-swtr)" />
      <text x="140" y="46" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em">
        SHOULDER LENGTH
      </text>

      {/* Sleeve (long — shoulder seam to cuff) */}
      <line x1="128" y1="78" x2="70" y2="265" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-swtr)" markerEnd="url(#arrow-swtr)" />
      <text x="20" y="170" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em" transform="rotate(-74 20 170)">
        SLEEVE
      </text>
    </svg>
  );
}
