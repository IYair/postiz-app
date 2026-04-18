'use client';

import React, { useCallback, useState } from 'react';
import useSWR from 'swr';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { Input } from '@gitroom/react/form/input';
import { Textarea } from '@gitroom/react/form/textarea';
import { Select } from '@gitroom/react/form/select';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

interface ImagePreset {
  id: string;
  name: string;
  stylePrompt: string;
  aspectRatio: string | null;
}

export const useImagePresets = () => {
  const fetch = useFetch();
  const load = useCallback(async () => {
    return (await fetch('/settings/image-presets')).json();
  }, []);
  return useSWR<ImagePreset[]>('image-presets', load, {
    revalidateOnFocus: false,
  });
};

const emptyForm = { name: '', stylePrompt: '', aspectRatio: '' };

const ImagePresetsComponent = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data, mutate, isLoading } = useImagePresets();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const startEdit = useCallback((p?: ImagePreset) => {
    if (p) {
      setEditingId(p.id);
      setForm({
        name: p.name,
        stylePrompt: p.stylePrompt,
        aspectRatio: p.aspectRatio ?? '',
      });
    } else {
      setEditingId('new');
      setForm(emptyForm);
    }
  }, []);

  const cancel = useCallback(() => {
    setEditingId(null);
    setForm(emptyForm);
  }, []);

  const save = useCallback(async () => {
    if (!form.name.trim() || !form.stylePrompt.trim()) {
      toaster.show(t('fill_all_fields', 'Name and style prompt are required'), 'warning');
      return;
    }
    const body = {
      name: form.name.trim(),
      stylePrompt: form.stylePrompt.trim(),
      aspectRatio: form.aspectRatio || undefined,
    };
    if (editingId === 'new') {
      await fetch('/settings/image-presets', {
        method: 'POST',
        body: JSON.stringify(body),
      });
    } else {
      await fetch(`/settings/image-presets/${editingId}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
    }
    toaster.show(t('preset_saved', 'Preset saved'), 'success');
    cancel();
    mutate();
  }, [editingId, form, fetch, mutate, cancel, toaster, t]);

  const remove = useCallback(
    async (id: string) => {
      if (!confirm(t('confirm_delete_preset', 'Delete this preset?'))) return;
      await fetch(`/settings/image-presets/${id}`, { method: 'DELETE' });
      toaster.show(t('preset_deleted', 'Preset deleted'), 'success');
      mutate();
    },
    [fetch, mutate, toaster, t]
  );

  if (isLoading) {
    return (
      <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px]">
        <div className="animate-pulse">{t('loading', 'Loading...')}</div>
      </div>
    );
  }

  return (
    <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
      <div className="flex items-center justify-between">
        <div className="mt-[4px]">
          {t('custom_image_presets', 'Custom Image Presets')}
        </div>
        <Button onClick={() => startEdit()} disabled={editingId !== null}>
          {t('new_preset', 'New preset')}
        </Button>
      </div>
      <div className="text-[12px] text-customColor18">
        {t(
          'image_presets_description',
          'Custom style presets that appear alongside the default list in the "AI Image" button. Each preset has a name, a style description, and an optional default aspect ratio.'
        )}
      </div>

      {editingId && (
        <div className="border border-fifth rounded-[4px] p-[16px] flex flex-col gap-[12px]">
          <Input
            name="presetName"
            label={t('name', 'Name')}
            disableForm={true}
            hideErrors={true}
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm({ ...form, name: e.target.value })
            }
            placeholder="e.g. AlianzaDev Hero"
          />
          <Textarea
            name="presetStyle"
            label={t('style_prompt', 'Style prompt')}
            disableForm={true}
            hideErrors={true}
            value={form.stylePrompt}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setForm({ ...form, stylePrompt: e.target.value })
            }
            rows={5}
            placeholder="Minimalist tech illustration, brand palette, no humans..."
          />
          <Select
            name="presetAspect"
            label={t('default_aspect_ratio', 'Default aspect ratio (optional)')}
            disableForm={true}
            hideErrors={true}
            value={form.aspectRatio}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setForm({ ...form, aspectRatio: e.target.value })
            }
          >
            <option value="">(use global selection)</option>
            <option value="square">1:1 square</option>
            <option value="portrait">4:5 portrait (LinkedIn / IG feed)</option>
            <option value="landscape">16:9 landscape (FB / Twitter)</option>
            <option value="story">9:16 story (IG / FB reel)</option>
          </Select>
          <div className="flex gap-[8px] justify-end">
            <Button secondary={true} onClick={cancel}>
              {t('cancel', 'Cancel')}
            </Button>
            <Button onClick={save}>{t('save', 'Save')}</Button>
          </div>
        </div>
      )}

      {data && data.length > 0 && (
        <div className="flex flex-col gap-[8px]">
          {data.map((p) => (
            <div
              key={p.id}
              className="flex items-start justify-between gap-[12px] border border-fifth rounded-[4px] p-[12px]"
            >
              <div className="flex-1 min-w-0">
                <div className="font-[600] text-[14px]">{p.name}</div>
                <div className="text-[11px] text-customColor18 line-clamp-2 mt-[2px]">
                  {p.stylePrompt}
                </div>
                {p.aspectRatio && (
                  <div className="text-[10px] text-customColor18 mt-[4px]">
                    Default: {p.aspectRatio}
                  </div>
                )}
              </div>
              <div className="flex gap-[6px] flex-shrink-0">
                <Button
                  secondary={true}
                  onClick={() => startEdit(p)}
                  disabled={editingId !== null}
                >
                  {t('edit', 'Edit')}
                </Button>
                <Button
                  secondary={true}
                  onClick={() => remove(p.id)}
                  disabled={editingId !== null}
                >
                  {t('delete', 'Delete')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {(!data || data.length === 0) && !editingId && (
        <div className="text-[12px] text-customColor18 text-center py-[12px]">
          {t(
            'no_presets_yet',
            'No custom presets yet. Create one to replace or extend the default style list.'
          )}
        </div>
      )}
    </div>
  );
};

export default ImagePresetsComponent;
