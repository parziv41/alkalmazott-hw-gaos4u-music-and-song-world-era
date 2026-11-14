/** Accent-tinted aurora glows behind the globe. */
export function MapBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="stars absolute inset-0" />
    </div>
  )
}

/** Vignette and film grain over the map, under the UI. */
export function MapOverlay() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="vignette absolute inset-0" />
      <div className="grain absolute inset-0" />
    </div>
  )
}

/** Gradients for the sphere: deep ocean, light from the upper left, and an atmosphere halo. */
export function MapDefs() {
  return (
    <defs>
      <radialGradient id="ocean" cx="38%" cy="32%" r="78%">
        <stop offset="0%" stopColor="#15244c" />
        <stop offset="62%" stopColor="#0c1532" />
        <stop offset="100%" stopColor="#060b1b" />
      </radialGradient>
      <radialGradient id="shade" cx="34%" cy="28%" r="82%">
        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.09" />
        <stop offset="38%" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="74%" stopColor="#02040b" stopOpacity="0" />
        <stop offset="100%" stopColor="#02040b" stopOpacity="0.55" />
      </radialGradient>
      {/* The halo starts at the globe's edge (1 / 1.14 of this circle's radius) and fades out. */}
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="84%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
        <stop offset="87.7%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.32 }} />
        <stop offset="92%" style={{ stopColor: 'var(--accent)', stopOpacity: 0.08 }} />
        <stop offset="100%" style={{ stopColor: 'var(--accent)', stopOpacity: 0 }} />
      </radialGradient>
      {/* Follows the global accent, so it animates along with the rest of the UI. */}
      <linearGradient id="highlight" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" style={{ stopColor: 'var(--accent)' }} />
        <stop offset="100%" style={{ stopColor: 'var(--accent-strong)' }} />
      </linearGradient>
    </defs>
  )
}
