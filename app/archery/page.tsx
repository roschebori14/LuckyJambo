import type { Metadata } from "next";
import ArcheryGame from "@/components/archery/ArcheryGame";

export const metadata: Metadata = {
  title: "Archery",
};

// This page itself is a server component (the default for App
// Router) - it's ArcheryGame.tsx, one level down, that's marked
// "use client" and owns the dynamic(..., { ssr: false }) import.
// Keeping the page a plain server component costs nothing and is one
// less client boundary than necessary.
export default function ArcheryPage() {
  return <ArcheryGame />;
}
