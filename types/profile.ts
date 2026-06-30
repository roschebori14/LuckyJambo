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

export interface PublicProfile {
  id: string;

  username: string;

  avatar_url: string | null;

  is_online: boolean;
}
