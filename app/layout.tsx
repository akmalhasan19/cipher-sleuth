import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const creamyChalk = localFont({
  src: "../creamy-chalk-font/CreamyChalk-PKa4E.ttf",
  variable: "--font-creamy-chalk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Cipher Sleuth - Multi-Agent Image Forensics",
  description: "Verify digital authenticity with multi-agent AI forensics.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased ${creamyChalk.variable}`}>
        {children}
      </body>
    </html>
  );
}
