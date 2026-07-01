"use client";

import { useState } from "react";

export default function ProfileForm() {
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    console.log({
      fullName,
      bio,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Full Name"
        className="w-full rounded border p-3"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />

      <textarea
        placeholder="Bio"
        className="w-full rounded border p-3"
        value={bio}
        onChange={(e) => setBio(e.target.value)}
      />

      <button
        type="submit"
        className="rounded bg-blue-600 px-6 py-3 text-white"
      >
        Save Profile
      </button>
    </form>
  );
}
