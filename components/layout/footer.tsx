import Link from "next/link";
import CookieSettingsLink from "@/components/cookies/cookie-settings-link";

export default function Footer() {
  return (
    <footer className="border-t bg-white py-4">
      <div className="mx-auto flex max-w-7xl flex-col items-center gap-2 px-4 text-center text-sm text-gray-500">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
          <Link href="/legal/terms" className="hover:text-blue-600 hover:underline">Terms</Link>
          <Link href="/legal/privacy" className="hover:text-blue-600 hover:underline">Privacy</Link>
          <Link href="/legal/cookies" className="hover:text-blue-600 hover:underline">Cookies</Link>
          <CookieSettingsLink className="hover:text-blue-600 hover:underline">
            Cookie settings
          </CookieSettingsLink>
        </div>
        <div>© {new Date().getFullYear()} Lucky Jambo. All rights reserved.</div>
      </div>
    </footer>
  );
}
