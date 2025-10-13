export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

export interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}