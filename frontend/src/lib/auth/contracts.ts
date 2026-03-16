export interface AuthCredentials {
  email: string;
  password: string;
}

export interface AuthRegisterCredentials extends AuthCredentials {
  full_name: string;
}

export interface AuthUser {
  id?: string;
  email?: string;
  full_name?: string;
}

export interface AuthResponse {
  authenticated: boolean;
  user?: AuthUser;
}
