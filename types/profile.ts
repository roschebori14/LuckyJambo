export interface UserProfile {
  id: string;

  username: string;

  email: string;

  full_name: string | null;

  avatar_url: string | null;

  bio: string | null;

  country: string;

  role: "user" | "admin";

  is_verified: boolean;

  is_online: boolean;

  created_at: string;

  updated_at: string;
}

export interface UpdateProfileData {
  full_name?: string;

  username?: string;

  bio?: string;

  avatar_url?: string;
}

// Curated fields safe to show for any user, not just yourself - never
// email, phone, is_banned, or invite_code. `is_online` isn't stored on
// the row at all; it's derived live from the presence channel
// (lib/presence/presence-context.tsx), so it isn't part of this type.
export interface PublicProfile {
  id: string;

  username: string;

  avatar_url: string | null;

  is_verified: boolean;
}

export interface ProfileStats {
  wins: number;

  losses: number;

  matches_played: number;
}

// Returned by the get_public_profile RPC for the /profile/[username]
// page - PublicProfile plus the extra fields worth showing on a full
// profile view.
export interface PublicProfileDetail extends PublicProfile, ProfileStats {
  bio: string | null;

  country: string;

  role: "user" | "admin";

  created_at: string;
}

export type FriendshipStatus =
  | "self"
  | "friends"
  | "request_sent"
  | "request_received"
  | "none";
