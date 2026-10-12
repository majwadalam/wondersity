/** Stripe's button arrow: the stem appears and the head nudges right on hover (CSS in globals.css). */
export function HoverArrow() {
  return (
    <svg className="hover-arrow" width="10" height="10" viewBox="0 0 10 10" aria-hidden>
      <path className="stem" d="M0 5h7" stroke="currentColor" strokeWidth="1.6" fill="none" />
      <path className="head" d="M1 1l4 4-4 4" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  );
}
