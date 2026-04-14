'use client';

import React, { ReactNode, useCallback, useState, useEffect } from 'react';
import { Logo } from '@gitroom/frontend/components/new-layout/logo';
import { Plus_Jakarta_Sans } from 'next/font/google';
const ModeComponent = dynamic(
  () => import('@gitroom/frontend/components/layout/mode.component'),
  {
    ssr: false,
  }
);

import clsx from 'clsx';
import dynamic from 'next/dynamic';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useVariables } from '@gitroom/react/helpers/variable.context';
import { useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import { CheckPayment } from '@gitroom/frontend/components/layout/check.payment';
import { ToolTip } from '@gitroom/frontend/components/layout/top.tip';
import { ShowMediaBoxModal } from '@gitroom/frontend/components/media/media.component';
import { ShowLinkedinCompany } from '@gitroom/frontend/components/launches/helpers/linkedin.component';
import { MediaSettingsLayout } from '@gitroom/frontend/components/launches/helpers/media.settings.component';
import { Toaster } from '@gitroom/react/toaster/toaster';
import { ShowPostSelector } from '@gitroom/frontend/components/post-url-selector/post.url.selector';
import { NewSubscription } from '@gitroom/frontend/components/layout/new.subscription';
import { Support } from '@gitroom/frontend/components/layout/support';
import { ContinueProvider } from '@gitroom/frontend/components/layout/continue.provider';
import { ContextWrapper } from '@gitroom/frontend/components/layout/user.context';
import { CopilotKit } from '@copilotkit/react-core';
import { MantineWrapper } from '@gitroom/react/helpers/mantine.wrapper';
import { Impersonate } from '@gitroom/frontend/components/layout/impersonate';
import { AnnouncementBanner } from '@gitroom/frontend/components/layout/announcement.banner';
import { Title } from '@gitroom/frontend/components/layout/title';
import { TopMenu } from '@gitroom/frontend/components/layout/top.menu';
import { LanguageComponent } from '@gitroom/frontend/components/layout/language.component';
import { ChromeExtensionComponent } from '@gitroom/frontend/components/layout/chrome.extension.component';
import NotificationComponent from '@gitroom/frontend/components/notifications/notification.component';
import { OrganizationSelector } from '@gitroom/frontend/components/layout/organization.selector';
import { StreakComponent } from '@gitroom/frontend/components/layout/streak.component';
import { PreConditionComponent } from '@gitroom/frontend/components/layout/pre-condition.component';
import { AttachToFeedbackIcon } from '@gitroom/frontend/components/new-layout/sentry.feedback.component';
import { FirstBillingComponent } from '@gitroom/frontend/components/billing/first.billing.component';
import { useIsMobile } from '@gitroom/frontend/components/launches/helpers/use.is.mobile';

const jakartaSans = Plus_Jakarta_Sans({
  weight: ['600', '500', '700'],
  style: ['normal', 'italic'],
  subsets: ['latin'],
});

export const LayoutComponent = ({ children }: { children: ReactNode }) => {
  const fetch = useFetch();

  const { backendUrl, billingEnabled, isGeneral } = useVariables();

  // Feedback icon component attaches Sentry feedback to a top-bar icon when DSN is present
  const searchParams = useSearchParams();
  const load = useCallback(async (path: string) => {
    return await (await fetch(path)).json();
  }, []);
  const { data: user, mutate } = useSWR('/user/self', load, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    revalidateIfStale: false,
    refreshWhenOffline: false,
    refreshWhenHidden: false,
  });

  const isMobile = useIsMobile();
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    if (!(isMobile && navOpen)) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isMobile, navOpen]);

  if (!user) return null;

  return (
    <ContextWrapper user={user}>
      <CopilotKit
        credentials="include"
        runtimeUrl={backendUrl + '/copilot/chat'}
        showDevConsole={false}
      >
        <MantineWrapper>
          <ToolTip />
          <Toaster />
          <CheckPayment check={searchParams.get('check') || ''} mutate={mutate}>
            <ShowMediaBoxModal />
            <ShowLinkedinCompany />
            <MediaSettingsLayout />
            <ShowPostSelector />
            <PreConditionComponent />
            <NewSubscription />
            <ContinueProvider />
            <div
              className={clsx(
                'flex flex-col min-h-screen min-w-screen text-newTextColor p-[12px]',
                jakartaSans.className
              )}
            >
              <div>{user?.admin ? <Impersonate /> : <div />}</div>
              {user.tier === 'FREE' && isGeneral && billingEnabled ? (
                <FirstBillingComponent />
              ) : (
                <>
                  <AnnouncementBanner />
                  <div className="flex-1 flex gap-[8px] md:gap-[8px]">
                    <Support />

                    {/* Mobile backdrop */}
                    {isMobile && navOpen && (
                      <div
                        className="fixed inset-0 bg-black/50 z-[9998] md:hidden"
                        onClick={() => setNavOpen(false)}
                        aria-hidden="true"
                      />
                    )}

                    {/* Left nav rail — desktop: fixed sidebar; mobile: off-canvas drawer */}
                    <div
                      className={clsx(
                        'flex flex-col bg-newBgColorInner rounded-[12px]',
                        'md:w-[80px]',
                        'max-md:fixed max-md:inset-y-0 max-md:start-0 max-md:z-[9999] max-md:w-[240px]',
                        'transition-transform duration-200',
                        isMobile && !navOpen
                          ? 'max-md:-translate-x-full rtl:max-md:translate-x-full'
                          : 'max-md:translate-x-0'
                      )}
                      {...(isMobile
                        ? {
                            id: 'app-nav-drawer',
                            role: 'dialog' as const,
                            'aria-modal': navOpen,
                            'aria-label': 'Navigation',
                            'aria-hidden': !navOpen,
                          }
                        : { id: 'left-menu' })}
                    >
                      <div
                        className={clsx(
                          'md:fixed md:h-full md:w-[64px] md:start-[17px] md:flex md:flex-1 md:top-0',
                          'max-md:flex max-md:flex-col max-md:h-full max-md:w-full',
                          user?.admin && 'pt-[60px] max-h-[1000px]:w-[500px]'
                        )}
                      >
                        <div className="flex flex-col h-full gap-[32px] flex-1 py-[12px] max-md:px-[12px]">
                          <Logo />
                          <TopMenu onNavigate={isMobile ? () => setNavOpen(false) : undefined} />
                        </div>
                      </div>
                    </div>

                    {/* Main content area */}
                    <div className="flex-1 bg-newBgLineColor rounded-[12px] overflow-hidden flex flex-col gap-[1px] blurMe min-w-0">
                      {/* Top bar */}
                      <div className="flex bg-newBgColorInner h-[56px] md:h-[80px] px-[12px] md:px-[20px] items-center gap-[8px] md:gap-[20px]">
                        {/* Hamburger — mobile only */}
                        <button
                          onClick={() => setNavOpen(true)}
                          className="md:hidden w-[40px] h-[40px] flex items-center justify-center rounded-[8px] border border-newTableBorder bg-newBgColorInner text-[20px] leading-none text-textItemBlur hover:text-newTextColor shrink-0"
                          aria-label="Open navigation"
                          aria-expanded={navOpen}
                          aria-controls="app-nav-drawer"
                        >
                          ☰
                        </button>

                        {/* Title */}
                        <div className="text-[24px] font-[600] flex flex-1 min-w-0 truncate">
                          <Title />
                        </div>

                        {/* Top bar icons */}
                        <div className="flex gap-[8px] md:gap-[20px] text-textItemBlur items-center">
                          <div className="hidden md:flex items-center gap-[20px]">
                            <StreakComponent />
                            <div className="w-[1px] h-[20px] bg-blockSeparator" />
                            <OrganizationSelector />
                            <div className="hover:text-newTextColor">
                              <ModeComponent />
                            </div>
                            <div className="w-[1px] h-[20px] bg-blockSeparator" />
                          </div>
                          <LanguageComponent />
                          <ChromeExtensionComponent />
                          <div className="hidden md:block w-[1px] h-[20px] bg-blockSeparator" />
                          <AttachToFeedbackIcon />
                          <NotificationComponent />
                        </div>
                      </div>
                      <div className="flex flex-1 gap-[1px]">{children}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CheckPayment>
        </MantineWrapper>
      </CopilotKit>
    </ContextWrapper>
  );
};
