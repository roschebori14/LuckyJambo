import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lucky Jambo - Play • Compete • Win",
  description: "Cameroon's premier peer-to-peer skill gaming platform. Play chess, draughts, and more. Win real money!",
  openGraph: {
    title: "Lucky Jambo - Play • Compete • Win",
    description: "Cameroon's premier peer-to-peer skill gaming platform",
    type: "website",
    url: "https://lucky-jambo.vercel.app",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-white antialiased">
        {children}
      </body>
    </html>
  );
}
