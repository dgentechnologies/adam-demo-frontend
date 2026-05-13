import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ADAM | DGEN Technologies",
  description: "Experience ADAM — Autonomous Desktop AI Module by DGEN Technologies.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
