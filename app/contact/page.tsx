import Link from "next/link";
import Image from "next/image";
import { Mail, MessageCircle, Clock } from "lucide-react";
import ContactForm from "@/components/contact/contact-form";

export const metadata = {
  title: "Contact Us | Lucky Jambo",
  description: "Get in touch with the Lucky Jambo support team.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between p-6">
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

      <div className="mx-auto max-w-6xl px-6 pb-24 pt-8">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl">
            Get in touch
          </h1>
          <p className="mt-4 text-lg text-gray-600">
            Questions about your wallet, a match, or anything else? Our support
            team is here to help.
          </p>
        </div>

        <div className="mt-16 grid grid-cols-1 gap-10 lg:grid-cols-3">
          {/* Info column */}
          <div className="space-y-6 lg:col-span-1">
            <div className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-600">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Email</h3>
                <a
                  href="mailto:roschebori14@gmail.com"
                  className="text-sm text-blue-600 hover:underline"
                >
                  roschebori14@gmail.com
                </a>
              </div>
            </div>

            <div className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                <MessageCircle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Live chat</h3>
                <p className="text-sm text-gray-600">
                  Use the chat bubble in the bottom-right corner of the homepage
                  for real-time help.
                </p>
              </div>
            </div>

            <div className="flex gap-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-green-100 text-green-600">
                <Clock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Response time</h3>
                <p className="text-sm text-gray-600">
                  We typically reply within 24 hours. Withdrawal issues are
                  prioritized.
                </p>
              </div>
            </div>
          </div>

          {/* Form column */}
          <div className="lg:col-span-2">
            <ContactForm />
          </div>
        </div>
      </div>
    </main>
  );
}
