import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Lucky Jambo",
  description: "Cameroon's Skill Gaming Platform",
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/icon.png",
  },
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
