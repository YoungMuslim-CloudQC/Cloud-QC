export function CloudMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6 17.5C3.5 17.5 2 15.7 2 13.7C2 11.9 3.3 10.4 5.1 10.1C5.6 7.2 8.1 5 11.2 5C13.9 5 16.2 6.7 17 9.1C19.3 9.4 21 11.3 21 13.6C21 16.1 18.9 18 16.4 18L6 17.5Z"
        stroke="var(--text-gradient-1)"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
