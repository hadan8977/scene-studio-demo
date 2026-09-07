'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';

/** Keep a dismissed proposal mounted for its exit; reopening cancels that exit. */
export function ProposalPresence({
  open,
  children,
}: {
  open: boolean;
  children: ReactNode;
}) {
  const [present, setPresent] = useState(open);
  const lastVisible = useRef(children);
  if (open) lastVisible.current = children;
  useEffect(() => {
    if (open) {
      setPresent(true);
      return;
    }
    const id = setTimeout(() => setPresent(false), 240);
    return () => clearTimeout(id);
  }, [open]);
  if (!open && !present) return null;
  return (
    <div
      className={'floating-proposal' + (!open ? ' is-leaving' : '')}
      inert={!open}
      aria-hidden={!open || undefined}
    >
      {open ? children : lastVisible.current}
    </div>
  );
}
