import { useState } from "react";
import { HelpCircle, Info } from "lucide-react";
import FaqModal from "./FaqModal";
import HowItWorksModal from "./HowItWorksModal";

export default function Footer() {
    const [showFaqModal, setShowFaqModal] = useState(false);
    const [showHowItWorksModal, setShowHowItWorksModal] = useState(false);

    return (
        <>
            <footer className="border-t border-border bg-background/50 backdrop-blur-md py-6 mt-auto">
                <div className="container mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-muted-foreground text-sm">
                        <img src="/favicon-16x16.png" alt="FileSoldier" className="w-4 h-4" />
                        <span>FileSoldier &copy; {new Date().getFullYear()}</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => setShowHowItWorksModal(true)}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            <Info className="w-4 h-4" />
                            How it Works
                        </button>
                        <button
                            onClick={() => setShowFaqModal(true)}
                            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            <HelpCircle className="w-4 h-4" />
                            FAQ
                        </button>
                    </div>
                </div>
            </footer>

            <FaqModal isOpen={showFaqModal} onClose={() => setShowFaqModal(false)} />
            <HowItWorksModal
                isOpen={showHowItWorksModal}
                onClose={() => setShowHowItWorksModal(false)}
            />
        </>
    );
}
