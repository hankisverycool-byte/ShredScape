import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shredscape — The mountain is yours",
  description: "An old-school alpine playground. Ride, trick, customize, and shred with friends.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
