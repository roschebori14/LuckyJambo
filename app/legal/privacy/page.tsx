import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Privacy Policy | Lucky Jambo",
  description: "How Lucky Jambo collects, uses, and protects your data.",
};

const LAST_UPDATED = "July 2, 2026";

export default function PrivacyPolicyPage() {
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
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="prose prose-gray mt-10 max-w-none space-y-8 text-gray-700 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:leading-7 [&_li]:leading-7 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
          <p>
            Lucky Jambo (&ldquo;we&rdquo;, &ldquo;us&rdquo;, or
            &ldquo;our&rdquo;) operates a real-money skill gaming platform for
            players in Cameroon. This Privacy Policy explains what information
            we collect when you use our website and services, how we use it, and
            the choices you have. By creating an account or otherwise using
            Lucky Jambo, you agree to the collection and use of information as
            described here.
          </p>

          <section>
            <h2>1. Information We Collect</h2>
            <p>We collect the following categories of information:</p>
            <ul>
              <li>
                <strong>Account information:</strong> the email address,
                username, and password you provide when you register, plus any
                profile details you add later (full name, avatar, phone number,
                country).
              </li>
              <li>
                <strong>Wallet and transaction data:</strong> deposit and
                withdrawal records, mobile money account numbers used for
                payouts, transaction references, and your wallet balance and
                ledger history.
              </li>
              <li>
                <strong>Gameplay data:</strong> matches you create or join,
                stakes, game moves and results, and match history, used to run
                games fairly and settle payouts correctly.
              </li>
              <li>
                <strong>Communications:</strong> messages you send us through
                the contact form, support chat, or live chat widget, including
                any details you choose to share in those conversations.
              </li>
              <li>
                <strong>Technical data:</strong> IP address, device and browser
                information, and usage logs, collected automatically to keep the
                platform secure and functioning.
              </li>
            </ul>
          </section>

          <section>
            <h2>2. How We Use Your Information</h2>
            <ul>
              <li>
                To create and maintain your account, wallet, and match history.
              </li>
              <li>
                To process deposits and withdrawals through our licensed payment
                partner (currently Fapshi, covering MTN Mobile Money and Orange
                Money).
              </li>
              <li>
                To operate matchmaking, run games, and settle stakes and
                winnings.
              </li>
              <li>
                To detect and prevent fraud, cheating, collusion, money
                laundering, and other abuse of the platform.
              </li>
              <li>
                To respond to support requests and communicate important account
                or service updates.
              </li>
              <li>
                To comply with applicable Cameroonian law, including tax and
                financial-reporting obligations.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. How We Share Your Information</h2>
            <p>
              We do not sell your personal information. We share it only in the
              following circumstances:
            </p>
            <ul>
              <li>
                <strong>Payment processing:</strong> deposit and withdrawal
                details are shared with Fapshi and the relevant mobile money
                network to complete transactions.
              </li>
              <li>
                <strong>Other players:</strong> your username, avatar, and
                match/game activity are visible to opponents and, where
                relevant, friends, since gameplay is inherently shared. Your
                email, phone number, and wallet balance are never shown to other
                players.
              </li>
              <li>
                <strong>Service providers:</strong> we use third-party providers
                for infrastructure (Supabase), transactional email (Resend), and
                live support chat (Tawk.to), each of whom can access only the
                data needed to provide their service.
              </li>
              <li>
                <strong>Legal and safety:</strong> we may disclose information
                where required by law, regulation, court order, or to protect
                the rights, property, or safety of Lucky Jambo, our users, or
                the public.
              </li>
            </ul>
          </section>

          <section>
            <h2>4. Data Retention</h2>
            <p>
              We keep account and transaction records for as long as your
              account is active and for a reasonable period afterward, as needed
              to meet legal, accounting, fraud prevention, and
              dispute-resolution obligations. Wallet ledger entries in
              particular are retained as a permanent audit trail of funds
              movement.
            </p>
          </section>

          <section>
            <h2>5. Data Security</h2>
            <p>
              We use industry-standard safeguards, including encrypted
              connections, row-level access controls on our database, and
              restricted, role-based access to sensitive operations such as
              wallet adjustments and payouts. No online service can guarantee
              absolute security, but we work to protect your information against
              unauthorized access, alteration, or loss.
            </p>
          </section>

          <section>
            <h2>6. Your Choices and Rights</h2>
            <ul>
              <li>
                You can review and update most of your profile information from
                your account settings.
              </li>
              <li>
                You can request a copy of the personal data we hold about you.
              </li>
              <li>
                You can request that we delete your account and associated
                personal data, subject to our need to retain certain records
                (e.g. transaction history) for legal and accounting purposes.
              </li>
              <li>
                You can contact us at any time with privacy questions or
                requests — see Section 9.
              </li>
            </ul>
          </section>

          <section>
            <h2>7. Children&rsquo;s Privacy</h2>
            <p>
              Lucky Jambo involves real-money stakes and is intended solely for
              users who are at least 18 years old, in line with our Terms of
              Service. We do not knowingly collect information from anyone under
              18. If we learn that an underage person has created an account, we
              will close it and remove their data.
            </p>
          </section>

          <section>
            <h2>8. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. If we make
              material changes, we&rsquo;ll notify you by email or through a
              notice on the platform before the change takes effect. The
              &ldquo;Last updated&rdquo; date at the top of this page reflects
              the most recent revision.
            </p>
          </section>

          <section>
            <h2>9. Cookies</h2>
            <p>
              We use cookies to keep you signed in and, with your permission, to
              power optional features like live chat support and remembering
              your login email. See our{" "}
              <Link
                href="/legal/cookies"
                className="text-blue-600 hover:underline"
              >
                Cookie Policy
              </Link>{" "}
              for the full list of cookies we use and how to manage your
              preferences.
            </p>
          </section>

          <section>
            <h2>10. Contact Us</h2>
            <p>
              If you have questions about this Privacy Policy or how your data
              is handled, contact us at{" "}
              <a
                href="mailto:luckjambo@gmail.com"
                className="text-blue-600 hover:underline"
              >
                luckjambo@gmail.com
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
