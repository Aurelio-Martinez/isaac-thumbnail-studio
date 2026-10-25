export function BrandMark({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      role="img"
      aria-label="Studio mark"
      shapeRendering="crispEdges"
    >
      <rect x="0.5" y="0.5" width="31" height="31" rx="3" fill="#14141a" stroke="#3a3a46" />
      <rect x="5" y="6" width="22" height="20" fill="#d5aa4a" />
      <rect x="7" y="8" width="18" height="16" fill="#0f0f13" />
      <rect x="12" y="12" width="8" height="7" fill="#f2ece0" />
      <rect x="14" y="13" width="2" height="2" fill="#d9482f" />
      <rect x="9" y="17" width="2" height="2" fill="#8b6fd1" />
      <rect x="21" y="17" width="2" height="2" fill="#8b6fd1" />
      <rect x="12" y="21" width="8" height="1" fill="#6f6960" />
    </svg>
  );
}
