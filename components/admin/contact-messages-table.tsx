"use client";

import { useState } from "react";
import { Mail, MailOpen, Archive, ChevronDown } from "lucide-react";

interface ContactSubmission {
  id: string;
  ip: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: "new" | "read" | "archived";
  created_at: string;
}

const STATUS_BADGE: Record<ContactSubmission["status"], string> = {
  new: "bg-yellow-500/20 text-yellow-400",
  read: "bg-blue-500/20 text-blue-400",
  archived: "bg-gray-500/20 text-gray-400",
};

export default function ContactMessagesTable({
  initialSubmissions,
}: {
  initialSubmissions: ContactSubmission[];
}) {
  const [submissions, setSubmissions] = useState(initialSubmissions);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  async function updateStatus(id: string, status: ContactSubmission["status"]) {
    setUpdatingId(id);
    try {
      const res = await fetch("/api/admin/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmissions(prev => prev.map(s => (s.id === id ? { ...s, status } : s)));
      }
    } finally {
      setUpdatingId(null);
    }
  }

  function toggleExpand(sub: ContactSubmission) {
    const opening = expandedId !== sub.id;
    setExpandedId(opening ? sub.id : null);
    if (opening && sub.status === "new") {
      updateStatus(sub.id, "read");
    }
  }

  return (
    <div className="lj-card overflow-hidden">
      <div className="divide-y" style={{ borderColor: "var(--lj-border)" }}>
        {submissions.map(sub => {
          const isExpanded = expandedId === sub.id;
          return (
            <div key={sub.id} className="px-5 py-4">
              <button
                type="button"
                onClick={() => toggleExpand(sub)}
                className="flex w-full flex-wrap items-center gap-3 text-left"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-white truncate">{sub.subject}</p>
                  <p className="text-xs text-[var(--lj-muted)] truncate">
                    {sub.name} · {sub.email}
                  </p>
                </div>
                <span className="text-xs text-[var(--lj-muted)]">
                  {new Date(sub.created_at).toLocaleString()}
                </span>
                <span className={`lj-badge ${STATUS_BADGE[sub.status]}`}>{sub.status}</span>
                <ChevronDown
                  size={16}
                  className="text-[var(--lj-muted)] transition-transform"
                  style={{ transform: isExpanded ? "rotate(180deg)" : "none" }}
                />
              </button>

              {isExpanded && (
                <div className="mt-3 rounded-lg p-4 text-sm" style={{ background: "var(--lj-card-2)" }}>
                  <p className="whitespace-pre-wrap text-[var(--lj-muted)]">{sub.message}</p>
                  <div className="mt-4 flex gap-2">
                    <button
                      type="button"
                      disabled={updatingId === sub.id || sub.status === "read"}
                      onClick={() => updateStatus(sub.id, "read")}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-blue-300 hover:bg-blue-500/10 disabled:opacity-40"
                    >
                      <MailOpen size={13} /> Mark read
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === sub.id || sub.status === "archived"}
                      onClick={() => updateStatus(sub.id, "archived")}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[var(--lj-muted)] hover:bg-white/10 disabled:opacity-40"
                    >
                      <Archive size={13} /> Archive
                    </button>
                    <button
                      type="button"
                      disabled={updatingId === sub.id || sub.status === "new"}
                      onClick={() => updateStatus(sub.id, "new")}
                      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-yellow-400 hover:bg-yellow-500/10 disabled:opacity-40"
                    >
                      <Mail size={13} /> Mark unread
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
