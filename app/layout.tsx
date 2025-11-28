import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Estelleo",
  description: `★ ! 2007  ·  Estelleo  ˙  ENFJ
 — my love !!  @shyabid
 ──★ ˙ ̟   https://discord.gg/fgDwqCAWb3 !!
 ˚.⊹ —————  ᶻ 𝗓 ✩  .ᐟ —————`,
  icons: {
    icon: "/favicon.webp",
  },
  openGraph: {
    images: ["/thumbnail.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
