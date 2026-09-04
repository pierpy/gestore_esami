export default function Logo({ size = 'md' }: { size?: 'md' | 'lg' }) {
  return (
    <span className={`logo-mark${size === 'lg' ? ' lg' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 24 24" width="100%" height="100%" fill="none">
        <path
          d="M6 12.5l3.8 3.8L18 8"
          stroke="white"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}
