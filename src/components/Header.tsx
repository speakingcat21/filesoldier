"use client";

import { useState } from "react";
import { HelpCircle, Info, Github } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useSession } from "@/lib/auth-client";
import UserMenu from "./UserMenu";
import LanguageSwitcher from "./LanguageSwitcher";
import { useTranslation } from "react-i18next";

// Lazy load modals - only loaded when user interacts
const AuthModal = dynamic(() => import("./AuthModal"), { ssr: false });
const FaqModal = dynamic(() => import("./FaqModal"), { ssr: false });
const HowItWorksModal = dynamic(() => import("./HowItWorksModal"), { ssr: false });

export function Header() {
    const { data: session, isPending } = useSession();
    const [showAuthModal, setShowAuthModal] = useState(false);
    const [showFaqModal, setShowFaqModal] = useState(false);
    const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);
    const { t } = useTranslation();

    const isSignedIn = !!session?.user;
    const user = session?.user;

    return (
        <>
            <header className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 bg-background/50 backdrop-blur-md border-b border-border">
                <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity min-h-[44px]">
                    <Image
                        src="/favicon-32x32.png"
                        alt="FileSoldier Logo"
                        width={32}
                        height={32}
                        className="w-8 h-8"
                        priority
                    />
                    <span className="font-bold text-foreground tracking-tight hidden xs:inline sm:inline">FileSoldier</span>
                </Link>

                <div className="flex items-center gap-2 sm:gap-4 md:gap-6">
                    <a
                        href="https://github.com/speakingcat21/file-soldier"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors"
                        aria-label="View on GitHub"
                    >
                        <Github className="w-5 h-5" />
                    </a>
                    <button
                        onClick={() => setShowHowItWorksModal(true)}
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
                    >
                        <Info className="w-4 h-4" />
                        <span className="hidden md:inline">{t('faq.howItWorks')}</span>
                    </button>
                    <button
                        onClick={() => setShowFaqModal(true)}
                        className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
                    >
                        <HelpCircle className="w-4 h-4" />
                        <span className="hidden md:inline">{t('header.faq')}</span>
                    </button>

                    <LanguageSwitcher />

                    {isPending ? (
                        <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-full bg-muted animate-pulse" />
                    ) : isSignedIn ? (
                        <>
                            <Link href="/my-files" className="hidden sm:flex p-2 min-h-[44px] items-center text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors">
                                {t('header.myFiles')}
                            </Link>
                            <UserMenu user={user} />
                        </>
                    ) : (
                        <button
                            onClick={() => setShowAuthModal(true)}
                            className="p-2 min-h-[44px] flex items-center text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
                        >
                            {t('header.login')}
                        </button>
                    )}
                </div>
            </header>

            <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
            <FaqModal isOpen={showFaqModal} onClose={() => setShowFaqModal(false)} />
            <HowItWorksModal isOpen={showHowItWorksModal} onClose={() => setShowHowItWorksModal(false)} />
        </>
    );
}
