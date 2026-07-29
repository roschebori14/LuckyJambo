import Link from "next/link";
import Image from "next/image";

export const metadata = {
  title: "Terms of Service | Lucky Jambo",
  description: "The terms that govern your use of Lucky Jambo.",
};

const LAST_UPDATED = "July 2, 2026";

export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          Last updated: {LAST_UPDATED}
        </p>

        <div className="prose prose-gray mt-10 max-w-none space-y-8 text-gray-700 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h2]:mt-10 [&_h2]:mb-3 [&_p]:leading-7 [&_li]:leading-7 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:space-y-1">
          <p>
            These Terms of Service (&ldquo;Terms&rdquo;) govern your access to
            and use of Lucky Jambo (&ldquo;the platform&rdquo;,
            &ldquo;we&rdquo;, &ldquo;us&rdquo;). By creating an account, you
            agree to be bound by these Terms. If you don&rsquo;t agree with
            them, please don&rsquo;t use the platform.
          </p>

          <section>
            <h2>1. Eligibility</h2>
            <ul>
              <li>
                You must be at least 18 years old to create an account or play
                for stakes.
              </li>
              <li>
                You must provide accurate registration information and keep your
                account credentials confidential. You are responsible for all
                activity under your account.
              </li>
              <li>
                One account per person. Creating multiple accounts to exploit
                bonuses, matchmaking, or withdrawal limits is prohibited and may
                result in suspension and forfeiture of funds.
              </li>
              <li>
                Lucky Jambo is a skill-based gaming platform. You are
                responsible for confirming that real-money skill gaming is
                lawful for you to participate in under the laws of your
                location.
              </li>
            </ul>
          </section>

          <section>
            <h2>2. Your Wallet, Deposits &amp; Withdrawals</h2>
            <ul>
              <li>
                Deposits are processed through our payment partner (Fapshi) via
                MTN Mobile Money or Orange Money. Funds are credited to your
                in-app wallet once payment is confirmed.
              </li>
              <li>
                Withdrawals are paid out to the mobile money account you provide
                and are subject to the minimum and maximum withdrawal limits
                shown in the app.
              </li>
              <li>
                We may hold, delay, or decline a withdrawal while we investigate
                suspected fraud, a payment dispute, a rule violation, or a
                request from a payment provider or regulator.
              </li>
              <li>
                Wallet balances are not a bank deposit and do not earn interest.
                Funds in your wallet represent your available balance for
                deposits, stakes, winnings, and withdrawals on the platform
                only.
              </li>
            </ul>
          </section>

          <section>
            <h2>3. Matches, Stakes &amp; Fees</h2>
            <ul>
              <li>
                When you create or join a match, your stake is moved from your
                available balance into the match pot for the duration of the
                game.
              </li>
              <li>
                The winner of a match receives the pot minus our platform fee
                (currently 5%, displayed before you confirm any match).
              </li>
              <li>
                Match outcomes are determined by actual gameplay recorded on our
                servers. In the event of a disconnect, timeout, or dispute, we
                apply our match-lifecycle and forfeit rules to determine the
                result; our decision on disputed matches is final.
              </li>
              <li>
                Cancelled or unmatched games are refunded to your wallet in
                full, minus no fee.
              </li>
            </ul>
          </section>

          <section>
            <h2>4. Prohibited Conduct</h2>
            <p>You agree not to:</p>
            <ul>
              <li>
                Use bots, scripts, or automated tools to play matches or move
                funds.
              </li>
              <li>
                Collude with other players to manipulate match outcomes or
                guarantee winnings.
              </li>
              <li>
                Exploit bugs, glitches, or errors in the platform, wallet, or
                payment integration instead of reporting them.
              </li>
              <li>
                Use the platform for money laundering or to move funds unrelated
                to genuine gameplay.
              </li>
              <li>
                Harass, threaten, or abuse other players or Lucky Jambo staff.
              </li>
              <li>
                Attempt to access another user&rsquo;s account, wallet, or data
                without authorization.
              </li>
            </ul>
            <p>
              Violating these rules may result in match voiding, fund
              forfeiture, account suspension, or a permanent ban, at our
              discretion.
            </p>
          </section>

          <section>
            <h2>5. Account Suspension &amp; Termination</h2>
            <p>
              We may suspend or close your account if we reasonably believe
              you&rsquo;ve violated these Terms, engaged in fraud or abuse, or
              if required by law or a payment partner. You may close your
              account at any time by contacting support; any remaining available
              balance will be paid out to you, subject to standard verification
              checks.
            </p>
          </section>

          <section>
            <h2>6. Disclaimers</h2>
            <p>
              The platform is provided &ldquo;as is&rdquo;. We do not guarantee
              that the service will be uninterrupted, error-free, or available
              at all times. Skill gaming carries inherent financial risk — only
              stake what you can afford, and note that outcomes depend on
              gameplay, not on Lucky Jambo.
            </p>
          </section>

          <section>
            <h2>7. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, Lucky Jambo and its team
              are not liable for indirect, incidental, or consequential damages
              arising from your use of the platform. Our total liability for any
              claim relating to your account is limited to the available wallet
              balance associated with that claim at the time it arose.
            </p>
          </section>

          <section>
            <h2>8. Changes to These Terms</h2>
            <p>
              We may update these Terms from time to time. Material changes will
              be announced via email or an in-app notice before they take
              effect. Continuing to use Lucky Jambo after a change takes effect
              means you accept the updated Terms.
            </p>
          </section>

          <section>
            <h2>9. Governing Law</h2>
            <p>
              These Terms are governed by the laws of the Republic of Cameroon.
              Any dispute that can&rsquo;t be resolved informally with our
              support team will be subject to the exclusive jurisdiction of the
              competent courts of Cameroon.
            </p>
          </section>

          <section>
            <h2>10. Contact Us</h2>
            <p>
              Questions about these Terms? Reach us at{" "}
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
