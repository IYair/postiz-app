'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import useSWR from 'swr';
import { Button } from '@gitroom/react/form/button';
import { useToaster } from '@gitroom/react/toaster/toaster';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import clsx from 'clsx';

interface AiConfigResponse {
  textProvider: string;
  imageProvider?: string | null;
  textModel?: string | null;
  imageModel?: string | null;
  keyHints: { anthropic?: string; openai?: string; gemini?: string };
}

interface AiConfigFormState {
  textProvider: string;
  imageProvider: string;
  textModel: string;
  imageModel: string;
  keys: { anthropic: string; openai: string; gemini: string };
}

const TEXT_MODEL_OPTIONS: Record<string, { value: string; label: string }[]> = {
  anthropic: [
    { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
  ],
  openai: [
    { value: 'gpt-4.1', label: 'GPT-4.1' },
    { value: 'gpt-4o', label: 'GPT-4o' },
  ],
  gemini: [
    { value: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite' },
  ],
};

const IMAGE_MODEL_OPTIONS: Record<string, { value: string; label: string }[]> =
  {
    openai: [{ value: 'dall-e-3', label: 'DALL-E 3' }],
    gemini: [
      { value: 'gemini-3.1-flash-image-preview', label: 'Gemini 3.1 Flash Image (Preview)' },
      { value: 'gemini-3-pro-image-preview', label: 'Gemini 3 Pro Image (Preview)' },
      { value: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
    ],
  };

const TEXT_PROVIDERS = [
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
];

const IMAGE_PROVIDERS = [
  { value: '', label: 'None' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'gemini', label: 'Google Gemini' },
];

const INITIAL_STATE: AiConfigFormState = {
  textProvider: 'openai',
  imageProvider: '',
  textModel: '',
  imageModel: '',
  keys: { anthropic: '', openai: '', gemini: '' },
};

export const useAiConfig = () => {
  const fetch = useFetch();

  const load = useCallback(async () => {
    return (await fetch('/user/ai-config')).json();
  }, []);

  return useSWR<AiConfigResponse | null>('ai-config', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    revalidateOnMount: true,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  });
};

const AiProviderComponent = () => {
  const t = useT();
  const fetch = useFetch();
  const toaster = useToaster();
  const { data, isLoading, mutate } = useAiConfig();

  const [form, setForm] = useState<AiConfigFormState>(INITIAL_STATE);
  const [keyHints, setKeyHints] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [hasExistingConfig, setHasExistingConfig] = useState(false);

  useEffect(() => {
    if (data) {
      setHasExistingConfig(true);
      setForm({
        textProvider: data.textProvider || 'openai',
        imageProvider: data.imageProvider || '',
        textModel: data.textModel || '',
        imageModel: data.imageModel || '',
        keys: { anthropic: '', openai: '', gemini: '' },
      });
      setKeyHints(data.keyHints || {});
    } else if (data === null) {
      setHasExistingConfig(false);
    }
  }, [data]);

  const updateForm = useCallback(
    (field: keyof AiConfigFormState, value: string) => {
      setForm((prev) => {
        const next = { ...prev, [field]: value };

        // When text provider changes, reset the text model to the first option
        if (field === 'textProvider') {
          const models = TEXT_MODEL_OPTIONS[value];
          next.textModel = models?.[0]?.value || '';
        }

        // When image provider changes, reset the image model to the first option
        if (field === 'imageProvider') {
          const models = IMAGE_MODEL_OPTIONS[value];
          next.imageModel = models?.[0]?.value || '';
        }

        return next;
      });
    },
    []
  );

  const updateKey = useCallback((provider: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      keys: { ...prev.keys, [provider]: value },
    }));
  }, []);

  // Which unique providers need API keys
  const requiredProviders = useCallback((): string[] => {
    const providers = new Set<string>();
    if (form.textProvider) providers.add(form.textProvider);
    if (form.imageProvider) providers.add(form.imageProvider);
    return Array.from(providers);
  }, [form.textProvider, form.imageProvider]);

  const handleTest = useCallback(
    async (provider: string) => {
      const apiKey = form.keys[provider as keyof typeof form.keys];
      if (!apiKey && !keyHints[provider]) {
        toaster.show(
          t(
            'ai_enter_key_first',
            'Please enter an API key before testing'
          ),
          'warning'
        );
        return;
      }
      if (!apiKey && keyHints[provider]) {
        toaster.show(
          t(
            'ai_reenter_key_to_test',
            'Please re-enter your API key to test the connection'
          ),
          'warning'
        );
        return;
      }

      setTesting((prev) => ({ ...prev, [provider]: true }));
      try {
        const res = await fetch('/user/ai-config/test', {
          method: 'POST',
          body: JSON.stringify({ provider, apiKey }),
        });
        const result = await res.json();
        if (result.success) {
          toaster.show(
            t('ai_test_success', 'Connection successful!'),
            'success'
          );
        } else {
          toaster.show(
            result.message ||
              t('ai_test_failed', 'Connection test failed'),
            'warning'
          );
        }
      } catch {
        toaster.show(t('ai_test_error', 'Connection test failed'), 'warning');
      } finally {
        setTesting((prev) => ({ ...prev, [provider]: false }));
      }
    },
    [form.keys, keyHints, fetch, toaster, t]
  );

  const handleSave = useCallback(async () => {
    // Build keys object: only include keys that were entered (non-empty)
    const keysToSend: Record<string, string> = {};
    for (const provider of requiredProviders()) {
      const key = form.keys[provider as keyof typeof form.keys];
      if (key) {
        keysToSend[provider] = key;
      }
    }

    // Must have at least a key hint or a new key for each required provider
    for (const provider of requiredProviders()) {
      const hasNewKey = !!keysToSend[provider];
      const hasExistingKey = !!keyHints[provider];
      if (!hasNewKey && !hasExistingKey) {
        toaster.show(
          t(
            'ai_key_required',
            `API key is required for ${provider}`
          ),
          'warning'
        );
        return;
      }
    }

    setSaving(true);
    try {
      await fetch('/user/ai-config', {
        method: 'PUT',
        body: JSON.stringify({
          textProvider: form.textProvider,
          imageProvider: form.imageProvider || null,
          textModel: form.textModel || null,
          imageModel: form.imageModel || null,
          keys: keysToSend,
        }),
      });

      await mutate();
      // Clear key inputs after save since they'll now show as hints
      setForm((prev) => ({
        ...prev,
        keys: { anthropic: '', openai: '', gemini: '' },
      }));
      toaster.show(
        t('ai_config_saved', 'AI configuration saved'),
        'success'
      );
    } catch {
      toaster.show(
        t('ai_config_save_error', 'Failed to save AI configuration'),
        'warning'
      );
    } finally {
      setSaving(false);
    }
  }, [form, keyHints, requiredProviders, fetch, mutate, toaster, t]);

  const handleDelete = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/user/ai-config', { method: 'DELETE' });
      await mutate();
      setForm(INITIAL_STATE);
      setKeyHints({});
      setHasExistingConfig(false);
      toaster.show(
        t('ai_config_deleted', 'AI configuration removed'),
        'success'
      );
    } catch {
      toaster.show(
        t('ai_config_delete_error', 'Failed to remove AI configuration'),
        'warning'
      );
    } finally {
      setSaving(false);
    }
  }, [fetch, mutate, toaster, t]);

  if (isLoading) {
    return (
      <div className="my-[16px] mt-[16px] bg-sixth border-fifth border rounded-[4px] p-[24px]">
        <div className="animate-pulse">
          {t('loading', 'Loading...')}
        </div>
      </div>
    );
  }

  const providers = requiredProviders();
  const showAnthropicImageNote =
    form.textProvider === 'anthropic' && !form.imageProvider;

  return (
    <div className="flex flex-col gap-[16px]">
      {/* Empty state banner */}
      {!hasExistingConfig && (
        <div className="bg-sixth border-fifth border rounded-[4px] p-[24px]">
          <div className="text-[14px] text-customColor18">
            {t(
              'ai_no_config',
              'No AI provider configured yet. Set up your preferred providers and API keys below to enable AI-powered features like content generation and image creation.'
            )}
          </div>
        </div>
      )}

      {/* Text Generation Card */}
      <div className="bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
        <div className="text-[16px] font-medium">
          {t('ai_text_generation', 'Text Generation')}
        </div>

        <div className="flex flex-col gap-[6px]">
          <div className="text-[14px]">
            {t('ai_text_provider', 'Provider')}
          </div>
          <select
            value={form.textProvider}
            onChange={(e) => updateForm('textProvider', e.target.value)}
            className="h-[42px] bg-newBgColorInner px-[16px] outline-none border-newTableBorder border rounded-[8px] text-[14px]"
          >
            {TEXT_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-[6px]">
          <div className="text-[14px]">
            {t('ai_text_model', 'Model')}
          </div>
          <select
            value={form.textModel}
            onChange={(e) => updateForm('textModel', e.target.value)}
            className="h-[42px] bg-newBgColorInner px-[16px] outline-none border-newTableBorder border rounded-[8px] text-[14px]"
          >
            {(TEXT_MODEL_OPTIONS[form.textProvider] || []).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Image Generation Card */}
      <div className="bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
        <div className="text-[16px] font-medium">
          {t('ai_image_generation', 'Image Generation')}
        </div>

        {showAnthropicImageNote && (
          <div className="text-[12px] text-customColor18 bg-newBgColorInner border-newTableBorder border rounded-[8px] p-[12px]">
            {t(
              'ai_anthropic_no_image',
              'Anthropic does not support image generation. Select an image provider below, or leave it as "None" to disable AI image generation.'
            )}
          </div>
        )}

        <div className="flex flex-col gap-[6px]">
          <div className="text-[14px]">
            {t('ai_image_provider', 'Provider')}
          </div>
          <select
            value={form.imageProvider}
            onChange={(e) => updateForm('imageProvider', e.target.value)}
            className="h-[42px] bg-newBgColorInner px-[16px] outline-none border-newTableBorder border rounded-[8px] text-[14px]"
          >
            {IMAGE_PROVIDERS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {form.imageProvider && (
          <div className="flex flex-col gap-[6px]">
            <div className="text-[14px]">
              {t('ai_image_model', 'Model')}
            </div>
            <select
              value={form.imageModel}
              onChange={(e) => updateForm('imageModel', e.target.value)}
              className="h-[42px] bg-newBgColorInner px-[16px] outline-none border-newTableBorder border rounded-[8px] text-[14px]"
            >
              {(IMAGE_MODEL_OPTIONS[form.imageProvider] || []).map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* API Keys Card */}
      {providers.length > 0 && (
        <div className="bg-sixth border-fifth border rounded-[4px] p-[24px] flex flex-col gap-[16px]">
          <div className="text-[16px] font-medium">
            {t('ai_api_keys', 'API Keys')}
          </div>

          {providers.map((provider) => {
            const providerLabel =
              TEXT_PROVIDERS.find((p) => p.value === provider)?.label ||
              IMAGE_PROVIDERS.find((p) => p.value === provider)?.label ||
              provider;
            const hint = keyHints[provider];
            const isTesting = testing[provider] || false;

            return (
              <div key={provider} className="flex flex-col gap-[6px]">
                <div className="text-[14px]">{providerLabel}</div>
                <div className="flex items-center gap-[8px]">
                  <div className="flex-1 bg-newBgColorInner h-[42px] border-newTableBorder border rounded-[8px] text-textColor placeholder-textColor flex items-center justify-center">
                    <input
                      type="password"
                      value={
                        form.keys[provider as keyof typeof form.keys] || ''
                      }
                      onChange={(e) => updateKey(provider, e.target.value)}
                      placeholder={
                        hint
                          ? `${t('ai_key_saved', 'Saved')} (${hint})`
                          : t('ai_enter_key', 'Enter API key...')
                      }
                      className="h-full bg-transparent outline-none flex-1 text-[14px] text-textColor px-[16px]"
                    />
                  </div>
                  <Button
                    className="rounded-[8px] h-[42px] text-[13px]"
                    secondary
                    loading={isTesting}
                    onClick={() => handleTest(provider)}
                  >
                    {t('ai_test', 'Test')}
                  </Button>
                </div>
                {hint && !form.keys[provider as keyof typeof form.keys] && (
                  <div className="text-[12px] text-customColor18">
                    {t('ai_key_already_saved', 'Key already saved. Enter a new key to replace it.')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-[12px]">
        <Button
          className="rounded-[8px]"
          loading={saving}
          onClick={handleSave}
        >
          {t('ai_save', 'Save Configuration')}
        </Button>
        {hasExistingConfig && (
          <Button
            className="rounded-[8px]"
            secondary
            loading={saving}
            onClick={handleDelete}
          >
            {t('ai_delete', 'Remove Configuration')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default AiProviderComponent;
