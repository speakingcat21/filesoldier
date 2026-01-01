"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Upload, Lock, Cloud, Download, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

interface HowItWorksModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function HowItWorksModal({ isOpen, onClose }: HowItWorksModalProps) {
    const { t } = useTranslation();

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-center">
                        {t("howItWorks.title")}
                    </DialogTitle>
                    <DialogDescription className="text-center">
                        {t("howItWorks.subtitle")}
                    </DialogDescription>
                </DialogHeader>

                {/* Infographic Flow */}
                <div className="mt-6 space-y-2">
                    {/* Step 1: Upload */}
                    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Upload className="w-7 h-7" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-foreground">1. {t("howItWorks.step1.title")}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {t("howItWorks.step1.description")}
                            </p>
                        </div>
                    </div>

                    {/* Arrow Down */}
                    <div className="flex justify-center">
                        <div className="w-0.5 h-4 bg-border"></div>
                    </div>

                    {/* Step 2: Encryption */}
                    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                        <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <Lock className="w-7 h-7" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-foreground">2. {t("howItWorks.step2.title")}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {t("howItWorks.step2.description")}
                            </p>
                        </div>
                    </div>

                    {/* Arrow Down */}
                    <div className="flex justify-center">
                        <div className="w-0.5 h-4 bg-border"></div>
                    </div>

                    {/* Step 3: Secure Storage */}
                    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                        <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                            <Cloud className="w-7 h-7" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-foreground">3. {t("howItWorks.step3.title")}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {t("howItWorks.step3.description")}
                            </p>
                        </div>
                    </div>

                    {/* Arrow Down */}
                    <div className="flex justify-center">
                        <div className="w-0.5 h-4 bg-border"></div>
                    </div>

                    {/* Step 4: Download */}
                    <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-xl border border-border/50">
                        <div className="w-14 h-14 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary shrink-0">
                            <Download className="w-7 h-7" />
                        </div>
                        <div className="flex-1">
                            <h3 className="font-semibold text-foreground">4. {t("howItWorks.step4.title")}</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {t("howItWorks.step4.description")}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Zero Knowledge Badge */}
                <div className="mt-4 p-3 bg-secondary/10 border border-secondary/30 rounded-xl">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="w-5 h-5 text-secondary shrink-0" />
                        <div>
                            <p className="text-sm font-medium text-secondary">{t("howItWorks.zeroKnowledge.title")}</p>
                            <p className="text-xs text-muted-foreground">{t("howItWorks.zeroKnowledge.description")}</p>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
