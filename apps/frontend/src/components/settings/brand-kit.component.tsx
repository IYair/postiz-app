'use client';

import React, { useCallback, useEffect, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Input } from '@gitroom/react/form/input';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

interface BrandKit {
  brandKitEnabled: boolean;
  brandLogoUrl: string | null;
  brandColors: string | null;
  brandTypography: string | null;
}

const useBrandKit = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/settings/brand-kit')).json();
  }, []);
  return useSWR<BrandKit>('brand-kit', load, { revalidateOnFocus: false });
};

const BrandKitComponent = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data, mutate, isLoading } = useBrandKit();

  const [enabled, setEnabled] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');
  const [colors, setColors] = useState('');
  const [typography, setTypography] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setEnabled(!!data.brandKitEnabled);
      setLogoUrl(data.brandLogoUrl ?? '');
      setColors(data.brandColors ?? '');
      setTypography(data.brandTypography ?? '');
    }
  }, [data]);

  const save = useCallback(async () => {
    setSaving(true);
    const body = {
      brandKitEnabled: enabled,
      brandLogoUrl: logoUrl.trim() || null,
      brandColors: colors.trim() || null,
      brandTypography: typography.trim() || null,
    };
    await fetch('/settings/brand-kit', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setSaving(false);
    mutate(body as BrandKit);
    toaster.show(t('brand_kit_saved', 'Brand kit saved'), 'success');
  }, [enabled, logoUrl, colors, typography, fetch, mutate, toaster, t]);

  if (isLoading) {
    return (
      <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px]">
        <div className="animate-pulse">{t('loading', 'Loading...')}</div>
      </div>
    );
  }

  return (
    <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
      <div className="mt-[4px]">{t('brand_kit', 'Brand Kit')}</div>
      <div className="text-[12px] text-customColor18">
        {t(
          'brand_kit_description',
          'When enabled, the AI Image generator automatically injects your brand colors, typography and logo as references, producing consistent on-brand images without editing every prompt.'
        )}
      </div>
      <label className="flex items-center gap-[8px] cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span className="text-[13px]">
          {t('enable_brand_kit', 'Enable brand kit auto-injection')}
        </span>
      </label>
      <Input
        name="brandLogoUrl"
        label={t('brand_logo_url', 'Brand logo URL')}
        disableForm={true}
        removeError={true}
        value={logoUrl}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setLogoUrl(e.target.value)
        }
        placeholder="https://your-cdn.com/logo.png"
      />
      <div className="text-[11px] text-customColor18 -mt-[8px]">
        {t(
          'brand_logo_hint',
          'Public URL of your logo (PNG/SVG, under 4MB). It will be attached as reference image when generating, unless the user already picked a custom reference.'
        )}
      </div>
      <Input
        name="brandColors"
        label={t('brand_colors', 'Brand colors')}
        disableForm={true}
        removeError={true}
        value={colors}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setColors(e.target.value)
        }
        placeholder="#0066FF primary, #000814 background, #FAFAFA text"
      />
      <Input
        name="brandTypography"
        label={t('brand_typography', 'Typography')}
        disableForm={true}
        removeError={true}
        value={typography}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          setTypography(e.target.value)
        }
        placeholder="Inter for headings, JetBrains Mono for code"
      />
      <div className="flex justify-end">
        <Button onClick={save} loading={saving}>
          {t('save', 'Save')}
        </Button>
      </div>
    </div>
  );
};

export default BrandKitComponent;
