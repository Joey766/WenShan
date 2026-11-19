import type { Metadata, Viewport } from "next";
import { PetProvider } from "@/components/pet-context";
import { Header } from "@/components/shell";
import { ProfileProvider } from "@/components/profile";
import { AccountProvider } from "@/components/account";
import "./globals.css";
import "./world.css";

export const metadata: Metadata = {
  title: { default: "问山 · 山海易经", template: "%s · 问山" },
  description: "与灵宠入山，以三枚铜钱、六次起卦读《周易》。",
};
export const viewport: Viewport = { viewportFit: "cover", interactiveWidget: "resizes-content", themeColor: "#49352e" };

export default function Layout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body><AccountProvider><PetProvider><ProfileProvider><Header />{children}</ProfileProvider></PetProvider></AccountProvider></body>
    </html>
  );
}
