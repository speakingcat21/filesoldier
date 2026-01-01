import { MyFiles } from "@/components/MyFiles";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "My Files",
    description: "Manage your uploaded files",
};

export default function Page() {
    return <MyFiles />;
}
