export interface LoginFormData {
  email: string;
  password: string;
}

export interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface ForgotPasswordFormData {
  email: string;
}

export interface AuthUser {
  id: string;

  email: string;

  username: string;

  role: "user" | "admin";

  is_verified: boolean;

  created_at: string;
}

export interface AuthState {
  user: AuthUser | null;

  loading: boolean;

  isAuthenticated: boolean;
}

export interface AuthResponse {
  success: boolean;

  message: string;

  user?: AuthUser;
}
