'use client';

import { FC, ReactNode, useEffect, useRef } from 'react';
import clsx from 'clsx';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  label?: string;
  maxHeight?: string;
  className?: string;
}

export const BottomSheet: FC<BottomSheetProps> = ({
  open,
  onClose,
  children,
  label,
  maxHeight = '80vh',
  className,
}) => {
  const previousFocus = useRef<HTMLElement | null>(null);
  const sheetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={clsx(
          'relative bg-newBgColorInner rounded-t-[16px] w-full overflow-y-auto outline-none',
          'pb-[env(safe-area-inset-bottom)] animate-[bottomSheetSlideUp_0.2s_ease-out]',
          className
        )}
        style={{ maxHeight }}
      >
        <div className="sticky top-0 flex justify-center pt-[8px] pb-[4px] bg-newBgColorInner">
          <div className="w-[40px] h-[4px] rounded-full bg-textColor/30" />
        </div>
        {children}
      </div>
    </div>
  );
};
