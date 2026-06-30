import "./globals.css";
import { ReactNode } from "react";

export const metadata = {
  title: "Lucky Jambo",
  description: "Cameroon's Skill Gaming Platform",
};

interface RootLayoutProps {
  children: ReactNode;
}

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
