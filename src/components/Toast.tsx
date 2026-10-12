"use client";

import { createPortal } from "react-dom";

/**
 * Bottom-centre toast; plays its 1.5s in/hold/out animation once per mount.
 * Portaled to <body> so ancestors with backdrop-filter/transform can't
 * become its containing block.
 */
export function Toast({ message }: { message: string }) {
  return createPortal(
    <div
      role="status"
      className="toast pointer-events-none fixed bottom-6 left-1/2 z-[60] rounded-full bg-fg px-4 py-2 text-sm text-white shadow-lg"
    >
      {message}
    </div>,
    document.body
  );
}
