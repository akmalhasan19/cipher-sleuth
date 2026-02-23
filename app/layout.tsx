import type { Metadata } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { Special_Elite, Staatliches, Permanent_Marker, Courier_Prime } from "next/font/google";
import "./globals.css";

const creamyChalk = localFont({
  src: "../creamy-chalk-font/CreamyChalk-PKa4E.ttf",
  variable: "--font-creamy-chalk",
  display: "swap",
});

const specialElite = Special_Elite({ weight: "400", subsets: ["latin"], variable: "--font-special-elite" });
const staatliches = Staatliches({ weight: "400", subsets: ["latin"], variable: "--font-staatliches" });
const permanentMarker = Permanent_Marker({ weight: "400", subsets: ["latin"], variable: "--font-permanent-marker" });
const courierPrime = Courier_Prime({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-courier-prime" });

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
      <head>
        <Script id="scroll-top-on-refresh" strategy="beforeInteractive">
          {`(() => {
            const navEntries = window.performance?.getEntriesByType?.("navigation");
            const navType = navEntries?.[0] && "type" in navEntries[0] ? navEntries[0].type : null;
            if (navType !== "reload") {
              return;
            }
            if ("scrollRestoration" in window.history) {
              window.history.scrollRestoration = "manual";
            }
            window.scrollTo(0, 0);
          })();`}
        </Script>
      </head>
      <body className={`antialiased overflow-x-hidden ${creamyChalk.variable} ${specialElite.variable} ${staatliches.variable} ${permanentMarker.variable} ${courierPrime.variable}`}>
        {children}
      </body>
    </html>
  );
}
