"use client";

import { useTranslation } from "react-i18next";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Simple SVG flag components for cross-platform compatibility (Windows doesn't render emoji flags)
const USFlag = () => (
    <svg className="w-5 h-3.5 rounded-sm overflow-hidden" viewBox="0 0 60 30" xmlns="http://www.w3.org/2000/svg">
        {/* Red stripes */}
        <rect width="60" height="30" fill="#B22234" />
        {/* White stripes */}
        <rect y="2.3" width="60" height="2.3" fill="#fff" />
        <rect y="6.9" width="60" height="2.3" fill="#fff" />
        <rect y="11.5" width="60" height="2.3" fill="#fff" />
        <rect y="16.2" width="60" height="2.3" fill="#fff" />
        <rect y="20.8" width="60" height="2.3" fill="#fff" />
        <rect y="25.4" width="60" height="2.3" fill="#fff" />
        {/* Blue canton */}
        <rect width="24" height="16.2" fill="#3C3B6E" />
    </svg>
);

const ESFlag = () => (
    <svg className="w-5 h-3.5 rounded-sm overflow-hidden" viewBox="0 0 60 40" xmlns="http://www.w3.org/2000/svg">
        <rect width="60" height="40" fill="#c60b1e" />
        <rect y="10" width="60" height="20" fill="#ffc400" />
    </svg>
);

const languages = [
    { code: "en", name: "English", Flag: USFlag },
    { code: "es", name: "Español", Flag: ESFlag },
];

export default function LanguageSwitcher() {
    const { i18n } = useTranslation();

    const handleLanguageChange = (value: string) => {
        i18n.changeLanguage(value);
    };

    const currentLang = languages.find(l => l.code === i18n.language) || languages[0];
    const CurrentFlag = currentLang.Flag;

    return (
        <Select value={i18n.language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="min-w-[130px] w-[130px] bg-background/50 backdrop-blur-md border-border/50 focus:ring-0 focus:ring-offset-0 shrink-0">
                <SelectValue>
                    <span className="flex items-center gap-2">
                        <CurrentFlag />
                        <span>{currentLang.name}</span>
                    </span>
                </SelectValue>
            </SelectTrigger>
            <SelectContent
                align="end"
                position="popper"
                sideOffset={4}
                className="min-w-[130px]"
            >
                {languages.map((lang) => (
                    <SelectItem key={lang.code} value={lang.code}>
                        <span className="flex items-center gap-2">
                            <lang.Flag />
                            <span>{lang.name}</span>
                        </span>
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    );
}
