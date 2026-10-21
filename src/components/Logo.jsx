import { useId } from 'react';

export default function Logo({ size = 28, spinning = false }) {
  const id = useId();
  return (
    <svg
      className={`logo${spinning ? ' logo--spin' : ''}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--accent-1)" />
          <stop offset="1" stopColor="var(--accent-2)" />
        </linearGradient>
      </defs>
      <path
        d="M16 2c1 7 6.9 12.9 14 14-7.1 1.1-13 7-14 14-1.1-7-7-12.9-14-14 7-1.1 12.9-7 14-14z"
        fill={`url(#${id})`}
      />
    </svg>
  );
}
