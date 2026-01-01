import { HomePage } from "@/components/HomePage";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "FileSoldier - Anonymous Encrypted File Sharing | Zero-Knowledge",
    description: "Share files anonymously with military-grade AES-256 encryption. Zero-knowledge architecture means only you and your recipient can access files. No sign-up required, self-destructing links, open source.",
};

export default function Page() {
    return <HomePage />;
}
