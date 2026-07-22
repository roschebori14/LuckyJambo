import Link from "next/link";
import Image from "next/image";
import CookieSettingsLink from "@/components/cookies/cookie-settings-link";

export const metadata = {
  title: "Cookie Policy | Lucky Jambo",
  description: "How and why Lucky Jambo uses cookies, and how to manage your preferences.",
};

const LAST_UPDATED = "July 22, 2026";

interface CookieRow {
  name: string;
  provider: string;
  purpose: string;
  duration: string;
}

const NECESSARY_COOKIES: CookieRow[] = [
  {
    name: "sb-*-auth-token",
    provider: "Lucky Jambo (Supabase)",
    purpose: "Keeps you signed in and identifies your session securely.",
    duration: "Session / up to 7 days",
  },
  {
    name: "lj_cookie_consent",
    provider: "Lucky Jambo",
    purpose: "Remembers your cookie preferences so we don't ask again every visit.",
    duration: "6 months",
  },
];

const FUNCTIONAL_COOKIES: CookieRow[] = [
  {
    name: "lj_remembered_email",
    provider: "Lucky Jambo",
    purpose: "Prefills your email address on the sign-in page if you tick \u201cRemember my email.\u201d",
    duration: "30 days",
  },
  {
    name: "TawkConnectionTime, __tawkuuid, and related cookies",
    provider: "Tawk.to (live chat)",
    purpose: "Lets our support widget recognize you across a chat conversation.",
    duration: "Session / up to 1 year",
  },
];

function CookieTable({ rows }: { rows: CookieRow[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-2 font-semibold">Cookie</th>
            <th className="px-4 py-2 font-semibold">Provider</th>
            <th className="px-4 py-2 font-semibold">Purpose</th>
            <th className="px-4 py-2 font-semibold">Duration</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-b border-gray-100 last:border-0 align-top">
              <td className="px-4 py-3 font-mono text-xs text-gray-800">{row.name}</td>
              <td className="px-4 py-3 text-gray-700">{row.provider}</td>
              <td className="px-4 py-3 text-gray-700">{row.purpose}</td>
              <td className="px-4 py-3 whitespace-nowrap text-gray-700">{row.duration}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CookiePolicyPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Nav */}
      <nav className="mx-auto flex max-w-4xl items-center justify-between p-6">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/images/logo.png"
            alt="Lucky Jambo Logo"
            width={40}
            height={40}
            className="rounded-xl shadow-sm"
          />
          <span className="text-lg font-black tracking-tight text-blue-900">
            Lucky Jambo
          </span>
        </Link>
        <Link
          href="/"
          className="text-sm font-semibold text-gray-600 hover:text-blue-600 transition-colors"
        >
          ← Back home
        </Link>
      </nav>

      <article className="mx-auto max-w-4xl px-6 pb-24 pt-8">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900">
          Cookie Policy
        </h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-gray mt-10 max-w-none space-y-8 text-gray-700 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:leading-7 [&_li]:leading-7 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">

          <p>
            This Cookie Policy explains what cookies are, which ones Lucky Jambo uses, and how you
            can control them. It should be read alongside our{" "}
            <Link href="/privacy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
          </p>

          <section>
            <h2>1. What Are Cookies?</h2>
            <p>
              Cookies are small text files that a website stores on your device. They let a site
              remember information about your visit, like whether you&rsquo;re signed in or what
              preferences you&rsquo;ve set, and can also be set by third-party services embedded
              in the page (such as our live chat widget).
            </p>
          </section>

          <section>
            <h2>2. How We Use Cookies</h2>
            <p>We group cookies into three categories. You choose which optional categories to allow the first time you visit, and can change your choice at any time.</p>
            <ul>
              <li><strong>Necessary</strong> &mdash; required for the site to function (staying signed in, remembering your cookie choice). These can&rsquo;t be turned off.</li>
              <li><strong>Functional</strong> &mdash; power optional features, like live chat support or remembering your email on the login page. If disabled, those features are unavailable or reset each visit.</li>
              <li><strong>Analytics</strong> &mdash; would help us understand aggregate usage patterns. We don&rsquo;t currently run any analytics provider, but we ask for this permission up front so we can add one later without changing your settings.</li>
            </ul>
          </section>

          <section>
            <h2>3. Necessary Cookies</h2>
            <CookieTable rows={NECESSARY_COOKIES} />
          </section>

          <section>
            <h2>4. Functional Cookies</h2>
            <CookieTable rows={FUNCTIONAL_COOKIES} />
          </section>

          <section>
            <h2>5. Analytics Cookies</h2>
            <p>
              We don&rsquo;t currently set any analytics cookies. If that changes, we&rsquo;ll list
              the specific cookies here and only activate them for visitors who&rsquo;ve opted in.
            </p>
          </section>

          <section>
            <h2>6. Managing Your Preferences</h2>
            <p>
              You can review or change your cookie choices at any time from{" "}
              <CookieSettingsLink className="text-blue-600 hover:underline">
                Cookie settings
              </CookieSettingsLink>
              , or clear cookies directly from your browser&rsquo;s settings. Blocking necessary
              cookies through your browser will likely prevent you from staying signed in.
            </p>
          </section>

          <section>
            <h2>7. Changes to This Policy</h2>
            <p>
              We may update this Cookie Policy as our use of cookies changes. Material changes
              will prompt you to re-confirm your preferences the next time you visit. The
              &ldquo;Last updated&rdquo; date above reflects the most recent revision.
            </p>
          </section>

          <section>
            <h2>8. Contact Us</h2>
            <p>
              Questions about this Cookie Policy? Reach us at{" "}
              <a href="mailto:support@luckyjambo.com" className="text-blue-600 hover:underline">
                support@luckyjambo.com
              </a>{" "}
              or via our{" "}
              <Link href="/contact" className="text-blue-600 hover:underline">
                contact page
              </Link>
              .
            </p>
          </section>
        </div>
      </article>
    </main>
  );
}
