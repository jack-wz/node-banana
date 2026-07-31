import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { Toast } from "@/components/Toast";

// Weavy uses DM Sans across the whole product
const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Node Banana - AI Image Workflow",
  description: "Node-based image annotation and generation workflow using Nano Banana Pro",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased ${dmSans.variable}`}>
        {children}
        <Toast />
      </body>
    </html>
  );
}
