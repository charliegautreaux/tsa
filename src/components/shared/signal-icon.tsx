export function SignalIcon({
  size = 28,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <path
        d="M64 368A80 80 0 0 1 144 448"
        stroke="#22c55e"
        strokeWidth="44"
        strokeLinecap="round"
      />
      <path
        d="M64 280A168 168 0 0 1 232 448"
        stroke="#eab308"
        strokeWidth="44"
        strokeLinecap="round"
      />
      <path
        d="M64 192A256 256 0 0 1 320 448"
        stroke="#f97316"
        strokeWidth="44"
        strokeLinecap="round"
      />
      <path
        d="M64 104A344 344 0 0 1 408 448"
        stroke="#ef4444"
        strokeWidth="44"
        strokeLinecap="round"
      />
    </svg>
  );
}
