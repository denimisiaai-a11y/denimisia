export function TshirtDiagram() {
  return (
    <svg
      viewBox="0 0 380 360"
      className="mx-auto h-auto w-full max-w-[380px]"
      aria-label="T-shirt flat measurement diagram"
    >
      <defs>
        <marker id="arrow-tee" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#dc2626" />
        </marker>
      </defs>

      {/* T-shirt outline */}
      <g stroke="#0a0a0a" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round">
        {/* Left shoulder -> sleeve -> hem */}
        <path d="M 125 70 L 70 105 L 95 150 L 125 140 L 125 310 L 255 310 L 255 140 L 285 150 L 310 105 L 255 70" />
        {/* Neck */}
        <path d="M 165 72 C 175 88, 205 88, 215 72" />
        {/* Sleeve hems */}
        <line x1="70" y1="105" x2="95" y2="150" strokeDasharray="0" />
        <line x1="310" y1="105" x2="285" y2="150" strokeDasharray="0" />
        {/* Sleeve band stitch detail */}
        <path d="M 82 128 L 110 117" />
        <path d="M 298 128 L 270 117" />
      </g>

      {/* Full Length (center vertical) */}
      <line x1="190" y1="80" x2="190" y2="305" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-tee)" markerEnd="url(#arrow-tee)" />
      <text x="196" y="200" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em">
        FULL LENGTH
      </text>

      {/* Chest (horizontal) */}
      <line x1="130" y1="180" x2="250" y2="180" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-tee)" markerEnd="url(#arrow-tee)" />
      <text x="160" y="174" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em">
        CHEST
      </text>

      {/* Shoulder length (across top, above garment) */}
      <line x1="125" y1="55" x2="255" y2="55" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-tee)" markerEnd="url(#arrow-tee)" />
      <text x="140" y="46" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em">
        SHOULDER LENGTH
      </text>

      {/* Sleeve length (along sleeve diagonal) */}
      <line x1="128" y1="78" x2="78" y2="108" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-tee)" markerEnd="url(#arrow-tee)" />
      <text x="60" y="78" fill="#dc2626" fontSize="10" fontWeight="600" letterSpacing="0.1em">
        SLEEVE
      </text>

      {/* Sleeve length (right side mirror, for symmetry) */}
      <line x1="252" y1="78" x2="302" y2="108" stroke="#dc2626" strokeWidth="1" markerStart="url(#arrow-tee)" markerEnd="url(#arrow-tee)" />
    </svg>
  );
}
