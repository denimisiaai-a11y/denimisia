export function OuterwearDiagram() {
  return (
    <svg
      viewBox="0 0 380 420"
      className="mx-auto h-auto w-full max-w-[380px]"
      aria-label="Outerwear flat measurement diagram"
    >
      <defs>
        <marker id="arrow-out" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
        </marker>
      </defs>

      {/* Jacket outline */}
      <g stroke="#0a0a0a" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round">
        {/* Collar + lapel */}
        <path d="M 165 70 L 155 88 L 175 98 L 190 88 L 205 98 L 225 88 L 215 70" />
        {/* Body */}
        <path d="M 125 70 L 55 265 L 100 290 L 130 180 L 130 360 L 250 360 L 250 180 L 280 290 L 325 265 L 255 70" />
        {/* Center zipper line */}
        <line x1="190" y1="98" x2="190" y2="360" strokeDasharray="2 3" />
        {/* Pockets */}
        <path d="M 140 240 L 170 240 L 172 258 L 140 258 Z" />
        <path d="M 240 240 L 210 240 L 208 258 L 240 258 Z" />
        {/* Cuffs */}
        <path d="M 55 265 L 100 290" strokeWidth="1" />
        <path d="M 62 258 L 98 280" strokeWidth="1" />
        <path d="M 325 265 L 280 290" strokeWidth="1" />
        <path d="M 318 258 L 282 280" strokeWidth="1" />
      </g>

      {/* Full Length */}
      <line x1="190" y1="82" x2="190" y2="358" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-out)" markerEnd="url(#arrow-out)" />
      <text x="196" y="220" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em">
        FULL LENGTH
      </text>

      {/* Chest */}
      <line x1="135" y1="210" x2="245" y2="210" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-out)" markerEnd="url(#arrow-out)" />
      <text x="160" y="204" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em">
        CHEST
      </text>

      {/* Shoulder */}
      <line x1="125" y1="55" x2="255" y2="55" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-out)" markerEnd="url(#arrow-out)" />
      <text x="140" y="46" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em">
        SHOULDER LENGTH
      </text>

      {/* Sleeve */}
      <line x1="128" y1="78" x2="70" y2="270" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-out)" markerEnd="url(#arrow-out)" />
      <text x="20" y="170" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em" transform="rotate(-74 20 170)">
        SLEEVE
      </text>

      {/* Jacket Length (right side) */}
      <line x1="340" y1="82" x2="340" y2="358" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-out)" markerEnd="url(#arrow-out)" />
      <text x="350" y="220" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em" transform="rotate(90 350 220)">
        JACKET LENGTH
      </text>
    </svg>
  );
}
