"use client";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { useTranslation } from "react-i18next";

interface FaqModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface FaqItem {
    question: string;
    answer: string;
}

export default function FaqModal({ isOpen, onClose }: FaqModalProps) {
    const { t } = useTranslation();
    const faqs = t("faq.items", { returnObjects: true }) as FaqItem[];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold">
                        {t("faq.title")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("faq.description")}
                    </DialogDescription>
                </DialogHeader>
                <Accordion type="single" collapsible className="w-full mt-4">
                    {Array.isArray(faqs) && faqs.map((faq, index) => (
                        <AccordionItem key={index} value={`item-${index}`}>
                            <AccordionTrigger className="text-left text-sm font-medium">
                                {faq.question}
                            </AccordionTrigger>
                            <AccordionContent className="text-muted-foreground text-sm">
                                {faq.answer}
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </DialogContent>
        </Dialog>
    );
}
