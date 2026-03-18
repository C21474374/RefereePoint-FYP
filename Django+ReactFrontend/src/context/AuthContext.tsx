import React, { createContext, useContext, useEffect, useState } from "react";
import {
  type CurrentUser,
  loginUser,
  fetchCurrentUser,
  saveTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  refreshAccessToken,
} from "../services/auth";

interface AuthContextType {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadUserFromToken() {
    const access = getAccessToken();
    const refresh = getRefreshToken();

    if (!access) {
      setLoading(false);
      return;
    }

    try {
      const currentUser = await fetchCurrentUser(access);
      setUser(currentUser);
    } catch (error) {
      if (!refresh) {
        clearTokens();
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        const newAccess = await refreshAccessToken(refresh);
        sessionStorage.setItem("accessToken", newAccess);
        const currentUser = await fetchCurrentUser(newAccess);
        setUser(currentUser);
      } catch {
        clearTokens();
        setUser(null);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserFromToken();
  }, []);

  async function login(email: string, password: string) {
    const { access, refresh } = await loginUser(email, password);
    saveTokens(access, refresh);

    const currentUser = await fetchCurrentUser(access);
    setUser(currentUser);
  }

  function logout() {
    clearTokens();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}