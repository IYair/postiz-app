'use client';

import { FC, useMemo, useState } from 'react';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useClickOutside } from '@mantine/hooks';
import { isUSCitizen } from '@gitroom/frontend/components/launches/helpers/isuscitizen.utils';
import clsx from 'clsx';
import { RepeatIcon, DropdownArrowIcon } from '@gitroom/frontend/components/ui/icons';
import { useIsMobile } from '@gitroom/frontend/components/launches/helpers/use.is.mobile';
import { BottomSheet } from '@gitroom/frontend/components/ui/bottom.sheet';

const getList = (t: (key: string, fallback: string) => string) => [
  {
    value: 1,
    label: t('day', 'Day'),
  },
  {
    value: 2,
    label: t('two_days', 'Two Days'),
  },
  {
    value: 3,
    label: t('three_days', 'Three Days'),
  },
  {
    value: 4,
    label: t('four_days', 'Four Days'),
  },
  {
    value: 5,
    label: t('five_days', 'Five Days'),
  },
  {
    value: 6,
    label: t('six_days', 'Six Days'),
  },
  {
    value: 7,
    label: t('week', 'Week'),
  },
  {
    value: 14,
    label: t('two_weeks', 'Two Weeks'),
  },
  {
    value: 30,
    label: t('month', 'Month'),
  },
  {
    value: null,
    label: t('cancel', 'Cancel'),
  },
];

export const RepeatComponent: FC<{
  repeat: number | null;
  onChange: (newVal: number) => void;
  iconOnly?: boolean;
}> = (props) => {
  const { repeat, iconOnly } = props;
  const t = useT();
  const list = getList(t);
  const [isOpen, setIsOpen] = useState(false);
  const isMobile = useIsMobile();

  const ref = useClickOutside(() => {
    if (!isOpen || isMobile) {
      return;
    }
    setIsOpen(false);
  });

  const everyLabel = useMemo(() => {
    if (!repeat) {
      return '';
    }
    return list.find((p) => p.value === repeat)?.label;
  }, [repeat, list]);

  const dropdownItems = (
    <>
      {list.map((p) => (
        <div
          onClick={() => {
            props.onChange(Number(p.value));
            setIsOpen(false);
          }}
          key={p.label}
          className="h-[48px] lg:h-[40px] py-[8px] px-[20px] flex items-center hover:bg-newBgColor cursor-pointer"
        >
          {p.label}
        </div>
      ))}
    </>
  );

  return (
    <div
      ref={isMobile ? undefined : ref}
      className={clsx(
        'border rounded-[8px] justify-center flex items-center relative h-[44px] text-[15px] font-[600] select-none',
        isOpen ? 'border-[#612BD3]' : 'border-newTextColor/10',
      )}
    >
      <div
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          'justify-center flex gap-[8px] items-center h-full select-none flex-1',
          iconOnly ? 'px-[10px]' : 'px-[16px]'
        )}
      >
        <div className="cursor-pointer">
          <RepeatIcon />
        </div>
        {!iconOnly && (
          <>
            <div className="cursor-pointer">
              {repeat
                ? `${t('repeat_post_every_label', 'Repeat Post Every')} ${everyLabel}`
                : t('repeat_post_every', 'Repeat Post Every...')}
            </div>
            <div className="cursor-pointer">
              <DropdownArrowIcon rotated={isOpen} />
            </div>
          </>
        )}
        {iconOnly && repeat && (
          <span className="text-[10px] font-[600] text-primary leading-none">
            {everyLabel?.[0]}
          </span>
        )}
      </div>
      {isMobile ? (
        <BottomSheet
          open={isOpen}
          onClose={() => setIsOpen(false)}
          label={t('repeat_post_every', 'Repeat Post Every...')}
        >
          <div className="pb-[16px]">{dropdownItems}</div>
        </BottomSheet>
      ) : (
        isOpen && (
          <div
            ref={ref}
            className="z-[300] absolute start-0 bottom-[100%] w-[240px] bg-newBgColorInner p-[12px] menu-shadow -translate-y-[10px] flex flex-col"
          >
            {dropdownItems}
          </div>
        )
      )}
    </div>
  );
};
