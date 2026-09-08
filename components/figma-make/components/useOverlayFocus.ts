import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react';

export function useOverlayFocus(
  open: boolean,
  ref: RefObject<HTMLElement | null>,
  onClose: () => void,
) {
  const close = useRef(onClose);
  useLayoutEffect(() => {
    close.current = onClose;
  });
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog
      ?.querySelector<HTMLElement>(
        'input:not([tabindex="-1"]),button:not([tabindex="-1"])',
      )
      ?.focus({ preventScroll: true });
    const keydown = (e: KeyboardEvent) => {
      if (!dialog || dialog.closest('[inert],[hidden]')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        close.current();
      }
      if (e.key !== 'Tab') return;
      const controls = [
        ...dialog.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),summary',
        ),
      ].filter(
        (el) =>
          el.tabIndex !== -1 &&
          !el.closest('[hidden],[inert]') &&
          (!el.closest('details:not([open])') || el.tagName === 'SUMMARY'),
      );
      const first = controls[0],
        last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus({ preventScroll: true });
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.removeEventListener('keydown', keydown);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, [open, ref]);
}
