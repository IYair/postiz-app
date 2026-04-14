'use client';

import { FC, ReactNode, useEffect } from 'react';
import clsx from 'clsx';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxHeight?: string;
  className?: string;
}

export const BottomSheet: FC<BottomSheetProps> = ({
  open,
  onClose,
  children,
  maxHeight = '80vh',
  className,
}) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={clsx(
          'relative bg-newBgColorInner rounded-t-[16px] w-full overflow-y-auto',
          'pb-[env(safe-area-inset-bottom)] animate-[slideUp_0.2s_ease-out]',
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
