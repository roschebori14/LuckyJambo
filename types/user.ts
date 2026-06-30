export type UserRole = "user" | "admin";

export interface Profile {
  id: string;
  email: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  country: string;
  is_verified: boolean;
  is_banned: boolean;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface PublicProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  country: string;
}

export interface AuthUser {
  id: string;
  email: string;
}

export interface UserSession {
  user: AuthUser;
  profile: Profile;
}
