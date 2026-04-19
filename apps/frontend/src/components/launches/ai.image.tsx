import { Button } from '@gitroom/react/form/button';
import { FC, useCallback, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import Loading from '@gitroom/frontend/components/layout/loading';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';
import { useLaunchStore } from '@gitroom/frontend/components/new-launch/store';
import { useImagePresets } from '@gitroom/frontend/components/settings/image-presets.component';

const DEFAULT_STYLES = [
  'Realistic',
  'Cartoon',
  'Anime',
  'Fantasy',
  'Abstract',
  'Pixel Art',
  'Sketch',
  'Watercolor',
  'Minimalist',
  'Cyberpunk',
  'Monochromatic',
  'Surreal',
  'Pop Art',
  'Fantasy Realism',
];

type AspectRatio = 'square' | 'landscape' | 'portrait' | 'story';
type AspectSelection = AspectRatio | 'auto';

const ASPECT_RATIOS: { value: AspectSelection; label: string; hint: string }[] = [
  { value: 'auto', label: 'Auto', hint: 'match each platform' },
  { value: 'portrait', label: '4:5', hint: 'LinkedIn / IG feed' },
  { value: 'square', label: '1:1', hint: 'IG / FB post' },
  { value: 'landscape', label: '16:9', hint: 'FB / Twitter / blog' },
  { value: 'story', label: '9:16', hint: 'IG / FB story / reel' },
];

// Preferred aspect ratio per platform, based on each network's feed default.
// Story-first platforms (tiktok) force 9:16; video platforms prefer landscape.
const PLATFORM_ASPECT: Record<string, AspectRatio> = {
  linkedin: 'portrait',
  'linkedin-page': 'portrait',
  facebook: 'portrait',
  instagram: 'square',
  'instagram-standalone': 'square',
  threads: 'square',
  pinterest: 'portrait',
  tiktok: 'story',
  youtube: 'landscape',
  x: 'landscape',
  reddit: 'landscape',
  bluesky: 'landscape',
  mastodon: 'landscape',
  telegram: 'square',
  discord: 'landscape',
  'google-my-business': 'landscape',
};

// Priority used to pick a single aspect ratio when the post targets several
// networks at once. Lower index wins. Story is forced first because TikTok
// and Reels literally don't accept anything else; portrait wins next so
// LinkedIn/IG-feed don't lose their native space.
const ASPECT_PRIORITY: AspectRatio[] = ['story', 'portrait', 'square', 'landscape'];

function resolveAutoAspect(
  integrations: { integration: { identifier: string } }[]
): AspectRatio {
  if (!integrations.length) return 'portrait';
  const chosen = new Set<AspectRatio>();
  for (const sel of integrations) {
    const aspect = PLATFORM_ASPECT[sel.integration.identifier];
    if (aspect) chosen.add(aspect);
  }
  if (!chosen.size) return 'portrait';
  for (const candidate of ASPECT_PRIORITY) {
    if (chosen.has(candidate)) return candidate;
  }
  return 'portrait';
}

const MAX_REFERENCE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB

function readFileAsBase64(
  file: File
): Promise<{ mimeType: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.replace(/^data:[^;]+;base64,/, '');
      resolve({ mimeType: file.type || 'image/png', base64 });
    };
    reader.readAsDataURL(file);
  });
}

function buildPrompt(description: string, style: string) {
  return `
<!-- description -->
${description}
<!-- /description -->

<!-- style -->
${style}
<!-- /style -->

`;
}

export const AiImage: FC<{
  value: string;
  onChange: (params: { id: string; path: string }) => void;
}> = (props) => {
  const t = useT();
  const { value, onChange } = props;
  const [loading, setLoading] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<AspectSelection>('auto');
  const [previewMode, setPreviewMode] = useState(true);
  const [referenceImage, setReferenceImage] = useState<{
    mimeType: string;
    base64: string;
    name: string;
  } | null>(null);
  const [lastResultPath, setLastResultPath] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [modal, setModal] = useState<{
    stylePrompt: string;
    style: string;
    expandedPrompt: string;
    aspect: AspectRatio;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const setLocked = useLaunchStore((p) => p.setLocked);
  const selectedIntegrations = useLaunchStore((p) => p.selectedIntegrations);
  const fetch = useFetch();
  const { data: presets } = useImagePresets();

  const autoAspect = useMemo(
    () => resolveAutoAspect(selectedIntegrations),
    [selectedIntegrations]
  );
  const effectiveAspect: AspectRatio =
    aspectRatio === 'auto' ? autoAspect : aspectRatio;

  const pickReference = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleReferenceChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > MAX_REFERENCE_SIZE_BYTES) {
        alert(t('reference_too_large', 'Reference image must be under 4MB'));
        return;
      }
      const { mimeType, base64 } = await readFileAsBase64(file);
      setReferenceImage({ mimeType, base64, name: file.name });
      // clear input so same file can be re-picked later
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [t]
  );

  const doGenerate = useCallback(
    async (
      finalPrompt: string,
      skipExpansion: boolean,
      aspectForRequest: AspectRatio
    ) => {
      // aspectForRequest is passed explicitly because setState is async —
      // reading effectiveAspect from the closure right after setAspectRatio
      // would still see the previous value and send the wrong ratio to the
      // server. Callers compute the final aspect locally and pass it in.
      setLoading(true);
      setLocked(true);
      const body: any = {
        prompt: finalPrompt,
        aspectRatio: aspectForRequest,
        skipExpansion,
      };
      if (referenceImage) {
        body.referenceImages = [
          {
            mimeType: referenceImage.mimeType,
            base64: referenceImage.base64,
          },
        ];
      }
      const image = await (
        await fetch('/media/generate-image-with-prompt', {
          method: 'POST',
          body: JSON.stringify(body),
        })
      ).json();
      setLoading(false);
      setLocked(false);
      setModal(null);
      if (image?.path) {
        setLastResultPath(image.path);
      }
      onChange(image);
    },
    [fetch, onChange, referenceImage, setLocked]
  );

  const regenerateWithFeedback = useCallback(async () => {
    if (!lastResultPath || !feedback.trim()) return;
    setLoading(true);
    setLocked(true);
    try {
      // Fetch the previous result to reuse it as style anchor for iteration.
      const resp = await window.fetch(lastResultPath);
      if (!resp.ok) {
        setLoading(false);
        setLocked(false);
        window.alert(
          t(
            'previous_image_unavailable',
            'Could not load the previous image (HTTP ' +
              resp.status +
              '). Generate a new image and try again.'
          )
        );
        return;
      }
      const blob = await resp.blob();
      // FileReader is non-blocking and handles the base64 encoding natively,
      // avoiding the quadratic string concat that used to freeze the tab on
      // multi-MB images.
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(reader.error ?? new Error('read error'));
        reader.onload = () => {
          const raw = reader.result as string;
          resolve(raw.replace(/^data:[^;]+;base64,/, ''));
        };
        reader.readAsDataURL(blob);
      });
      const mimeType = blob.type || 'image/png';

      const feedbackPrompt = `
<!-- description -->
${value}
<!-- /description -->

<!-- iteration instruction -->
${feedback}
<!-- /iteration instruction -->

<!-- style -->
Keep the overall style and composition of the reference image, apply only the iteration instruction above.
<!-- /style -->
`;

      const image = await (
        await fetch('/media/generate-image-with-prompt', {
          method: 'POST',
          body: JSON.stringify({
            prompt: feedbackPrompt,
            aspectRatio: effectiveAspect,
            referenceImages: [{ mimeType, base64 }],
          }),
        })
      ).json();

      setLoading(false);
      setLocked(false);
      if (image?.path) setLastResultPath(image.path);
      setFeedback('');
      onChange(image);
    } catch {
      setLoading(false);
      setLocked(false);
    }
  }, [lastResultPath, feedback, value, effectiveAspect, fetch, onChange, setLocked, t]);

  const startFlow = useCallback(
    (stylePrompt: string, presetAspect?: string | null) => async () => {
      // Resolve the aspect ratio for THIS request before any setState, so
      // the request body reflects the preset's default even though the
      // React state update hasn't flushed yet.
      let aspectForRequest: AspectRatio = effectiveAspect;
      if (
        presetAspect &&
        ASPECT_RATIOS.some(
          (r) => r.value === presetAspect && r.value !== 'auto'
        )
      ) {
        aspectForRequest = presetAspect as AspectRatio;
        setAspectRatio(aspectForRequest);
      }
      const rawPrompt = buildPrompt(value, stylePrompt);
      if (!previewMode) {
        await doGenerate(rawPrompt, false, aspectForRequest);
        return;
      }
      // Preview mode: ask backend to expand, show modal editable
      setLoading(true);
      setLocked(true);
      const { prompt: expanded } = await (
        await fetch('/media/expand-image-prompt', {
          method: 'POST',
          body: JSON.stringify({ prompt: rawPrompt }),
        })
      ).json();
      setLoading(false);
      setLocked(false);
      setModal({
        style: stylePrompt,
        stylePrompt: rawPrompt,
        expandedPrompt: expanded,
        aspect: aspectForRequest,
      });
    },
    [value, effectiveAspect, previewMode, doGenerate, fetch, setLocked]
  );

  const confirmFromModal = useCallback(async () => {
    if (!modal) return;
    await doGenerate(modal.expandedPrompt, true, modal.aspect);
  }, [modal, doGenerate]);

  const mergedStyles = useMemo(() => {
    const customEntries = (presets ?? []).map((p) => ({
      id: p.id,
      label: p.name,
      stylePrompt: p.stylePrompt,
      presetAspect: p.aspectRatio,
      custom: true,
    }));
    const defaultEntries = DEFAULT_STYLES.map((s) => ({
      id: `default-${s}`,
      label: s,
      stylePrompt: s,
      presetAspect: null as string | null,
      custom: false,
    }));
    return [...customEntries, ...defaultEntries];
  }, [presets]);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleReferenceChange}
        className="hidden"
      />
      <div className="relative group">
        <div
          {...(value.length < 30
            ? {
                'data-tooltip-id': 'tooltip',
                'data-tooltip-content':
                  'Please add at least 30 characters to generate AI image',
              }
            : {})}
          className={clsx(
            'cursor-pointer h-[30px] rounded-[6px] justify-center items-center flex bg-newColColor px-[8px]',
            value.length < 30 && 'opacity-50'
          )}
        >
          {loading && (
            <div className="absolute start-[50%] -translate-x-[50%]">
              <Loading height={15} width={15} type="spin" color="#fff" />
            </div>
          )}
          <div
            className={clsx(
              'flex gap-[5px] items-center',
              loading && 'invisible'
            )}
          >
            <div>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
              >
                <g clipPath="url(#clip0_2352_53053)">
                  <path
                    d="M8.33333 2.00033H5.2C4.07989 2.00033 3.51984 2.00033 3.09202 2.21831C2.71569 2.41006 2.40973 2.71602 2.21799 3.09234C2 3.52017 2 4.08022 2 5.20032V10.8003C2 11.9204 2 12.4805 2.21799 12.9083C2.40973 13.2846 2.71569 13.5906 3.09202 13.7823C3.51984 14.0003 4.07989 14.0003 5.2 14.0003H11.3333C11.9533 14.0003 12.2633 14.0003 12.5176 13.9322C13.2078 13.7472 13.7469 13.2081 13.9319 12.518C14 12.2636 14 11.9536 14 11.3337M7 5.66699C7 6.40337 6.40305 7.00033 5.66667 7.00033C4.93029 7.00033 4.33333 6.40337 4.33333 5.66699C4.33333 4.93061 4.93029 4.33366 5.66667 4.33366C6.40305 4.33366 7 4.93061 7 5.66699ZM9.99336 7.94576L4.3541 13.0724C4.03691 13.3607 3.87831 13.5049 3.86429 13.6298C3.85213 13.738 3.89364 13.8454 3.97546 13.9173C4.06985 14.0003 4.28419 14.0003 4.71286 14.0003H10.9707C11.9301 14.0003 12.4098 14.0003 12.7866 13.8391C13.2596 13.6368 13.6365 13.2599 13.8388 12.7869C14 12.4101 14 11.9304 14 10.971C14 10.6482 14 10.4867 13.9647 10.3364C13.9204 10.1475 13.8353 9.97056 13.7155 9.81792C13.6202 9.69646 13.4941 9.59562 13.242 9.39396L11.3772 7.9021C11.1249 7.70026 10.9988 7.59935 10.8599 7.56373C10.7374 7.53234 10.6086 7.53641 10.4884 7.57545C10.352 7.61975 10.2324 7.72842 9.99336 7.94576ZM13 1.01074L12.5932 1.82425C12.4556 2.09958 12.3868 2.23724 12.2948 2.35653C12.2132 2.46238 12.1183 2.55728 12.0125 2.63887C11.8932 2.73083 11.7555 2.79966 11.4802 2.93732L10.6667 3.34408L11.4802 3.75083C11.7555 3.88849 11.8932 3.95732 12.0125 4.04928C12.1183 4.13087 12.2132 4.22577 12.2948 4.33162C12.3868 4.45091 12.4556 4.58857 12.5932 4.8639L13 5.67741L13.4068 4.8639C13.5444 4.58857 13.6132 4.45091 13.7052 4.33162C13.7868 4.22577 13.8817 4.13087 13.9875 4.04928C14.1068 3.95732 14.2445 3.88849 14.5198 3.75083L15.3333 3.34408L14.5198 2.93732C14.2445 2.79966 14.1068 2.73083 13.9875 2.63887C13.8817 2.55728 13.7868 2.46238 13.7052 2.35653C13.6132 2.23724 13.5444 2.09958 13.4068 1.82425L13 1.01074Z"
                    stroke="currentColor"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_2352_53053">
                    <rect width="16" height="16" fill="currentColor" />
                  </clipPath>
                </defs>
              </svg>
            </div>
            <div className="text-[10px] font-[600] iconBreak:hidden block">
              {t('ai', 'AI')} Image
            </div>
          </div>
        </div>
        {value.length >= 30 && !loading && (
          <div className="text-[12px] -mt-[10px] w-[280px] absolute bottom-[100%] z-[500] start-0 hidden group-hover:block">
            <div className="rounded-[4px] border border-dashed mt-[3px] border-newBgLineColor bg-newColColor">
              <div className="p-[8px] border-b border-newBgLineColor">
                <div className="text-[10px] text-customColor18 mb-[4px]">
                  {t('aspect_ratio', 'Aspect ratio')}
                </div>
                <div className="grid grid-cols-2 gap-[4px]">
                  {ASPECT_RATIOS.map((r) => (
                    <button
                      key={r.value}
                      onClick={(e) => {
                        e.stopPropagation();
                        setAspectRatio(r.value);
                      }}
                      className={clsx(
                        'text-[11px] rounded-[3px] px-[6px] py-[3px] text-start',
                        aspectRatio === r.value
                          ? 'bg-sixth text-white'
                          : 'hover:bg-sixth'
                      )}
                    >
                      <div className="font-[600]">
                        {r.label}
                        {r.value === 'auto' && aspectRatio === 'auto' && (
                          <span className="ms-[4px] text-[9px] text-customColor18 font-[400]">
                            → {autoAspect}
                          </span>
                        )}
                      </div>
                      <div className="text-[9px] text-customColor18">
                        {r.hint}
                      </div>
                    </button>
                  ))}
                </div>
                {aspectRatio === 'auto' && (
                  <div className="text-[9px] text-customColor18 mt-[4px]">
                    {selectedIntegrations.length
                      ? `${selectedIntegrations.length} ${
                          selectedIntegrations.length === 1
                            ? 'platform'
                            : 'platforms'
                        } selected → ${autoAspect}`
                      : 'No platform selected — using portrait'}
                  </div>
                )}
              </div>
              <div className="p-[8px] border-b border-newBgLineColor flex flex-col gap-[6px]">
                <label className="flex items-center gap-[6px] text-[11px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={previewMode}
                    onChange={(e) => setPreviewMode(e.target.checked)}
                  />
                  {t('preview_final_prompt', 'Preview final prompt before generating')}
                </label>
                <div className="flex items-center justify-between gap-[6px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      pickReference();
                    }}
                    className="text-[11px] rounded-[3px] px-[6px] py-[3px] bg-sixth hover:bg-seventh"
                  >
                    {referenceImage
                      ? t('change_reference', 'Change reference')
                      : t('add_reference_image', 'Add reference image')}
                  </button>
                  {referenceImage && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setReferenceImage(null);
                      }}
                      className="text-[10px] text-customColor18 hover:text-red-400"
                      title="Clear reference"
                    >
                      ✕
                    </button>
                  )}
                </div>
                {referenceImage && (
                  <div className="text-[10px] text-customColor18 truncate">
                    {referenceImage.name}
                  </div>
                )}
              </div>
              <div className="p-[8px]">
                <div className="text-[10px] text-customColor18 mb-[4px]">
                  {t('style', 'Style')}
                </div>
                <ul className="cursor-pointer max-h-[220px] overflow-y-auto">
                  {mergedStyles.map((s) => (
                    <li
                      onClick={startFlow(s.stylePrompt, s.presetAspect)}
                      key={s.id}
                      className={clsx(
                        'hover:bg-sixth px-[6px] py-[2px] rounded-[3px] flex items-center justify-between',
                        s.custom && 'font-[600]'
                      )}
                    >
                      <span>{s.label}</span>
                      {s.custom && (
                        <span className="text-[9px] text-customColor18">custom</span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
              {lastResultPath && (
                <div className="p-[8px] border-t border-newBgLineColor flex flex-col gap-[6px]">
                  <div className="text-[10px] text-customColor18">
                    {t(
                      'regenerate_with_feedback',
                      'Regenerate with change (uses last result as reference)'
                    )}
                  </div>
                  <textarea
                    className="w-full bg-sixth border border-fifth rounded-[3px] p-[6px] text-[11px] min-h-[54px]"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder={t(
                      'feedback_placeholder',
                      'e.g. more minimalist, remove humans, change background to dark'
                    )}
                  />
                  <Button
                    onClick={regenerateWithFeedback}
                    disabled={!feedback.trim() || loading}
                    loading={loading}
                  >
                    {t('regenerate', 'Regenerate')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-[9999] bg-black/60 flex items-center justify-center p-[16px]"
          onClick={() => setModal(null)}
        >
          <div
            className="bg-newColColor rounded-[6px] p-[20px] max-w-[640px] w-full flex flex-col gap-[12px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-[14px] font-[600]">
              {t('review_final_prompt', 'Review final prompt')}
            </div>
            <div className="text-[11px] text-customColor18">
              {t(
                'review_prompt_hint',
                'Edit the prompt before generating. Brand style guide (if set) is already included. Style:'
              )}{' '}
              <span className="font-[600]">{modal.style}</span>
            </div>
            <textarea
              className="w-full bg-sixth border border-fifth rounded-[4px] p-[10px] text-[12px] font-mono min-h-[200px] max-h-[400px]"
              value={modal.expandedPrompt}
              onChange={(e) =>
                setModal({ ...modal, expandedPrompt: e.target.value })
              }
            />
            <div className="flex gap-[8px] justify-end">
              <Button secondary={true} onClick={() => setModal(null)}>
                {t('cancel', 'Cancel')}
              </Button>
              <Button onClick={confirmFromModal} loading={loading}>
                {t('generate', 'Generate')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
