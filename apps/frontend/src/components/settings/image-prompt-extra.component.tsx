'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Textarea } from '@gitroom/react/form/textarea';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

interface ImagePromptExtraResponse {
  imagePromptExtra: string | null;
}

export const useImagePromptExtra = () => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch('/settings/image-prompt-extra')).json();
  }, []);

  return useSWR<ImagePromptExtraResponse>('image-prompt-extra', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
};

const MAX_LENGTH = 2000;

const ImagePromptExtraComponent = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data, isLoading, mutate } = useImagePromptExtra();

  const [localValue, setLocalValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) {
      setLocalValue(data.imagePromptExtra ?? '');
    }
  }, [data]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    const trimmed = localValue.trim();
    await fetch('/settings/image-prompt-extra', {
      method: 'POST',
      body: JSON.stringify({
        imagePromptExtra: trimmed.length ? trimmed : null,
      }),
    });
    setSaving(false);
    mutate({ imagePromptExtra: trimmed.length ? trimmed : null });
    toaster.show(t('settings_updated', 'Settings updated'), 'success');
  }, [fetch, localValue, mutate, toaster, t]);

  if (isLoading) {
    return (
      <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px]">
        <div className="animate-pulse">{t('loading', 'Loading...')}</div>
      </div>
    );
  }

  const remaining = MAX_LENGTH - localValue.length;
  const disabled = saving || localValue.length > MAX_LENGTH;

  return (
    <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
      <div className="mt-[4px]">
        {t('ai_image_style_guide', 'AI Image Style Guide')}
      </div>
      <div className="text-[12px] text-customColor18">
        {t(
          'image_prompt_extra_description',
          'Text appended to every AI image prompt. Use it to describe brand style (palette, typography, composition, watermark). Applies to the "AI Image" button on post compose.'
        )}
      </div>
      <Textarea
        name="imagePromptExtra"
        label=""
        disableForm={true}
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
        className="min-h-[180px]"
        placeholder={t(
          'image_prompt_extra_placeholder',
          'Example: Minimalist tech illustration. Palette #0066FF + #000814. No humans or faces. Geometric shapes. Brand watermark bottom-right.'
        )}
      />
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-customColor18">
          {remaining >= 0
            ? t('chars_remaining', '{{remaining}} characters remaining', {
                remaining,
              })
            : t('chars_over_limit', 'Over limit by {{over}}', {
                over: -remaining,
              })}
        </div>
        <Button
          onClick={handleSave}
          disabled={disabled}
          loading={saving}
        >
          {t('save', 'Save')}
        </Button>
      </div>
    </div>
  );
};

export default ImagePromptExtraComponent;
