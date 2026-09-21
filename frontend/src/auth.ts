// Auth context – shared session state across the whole app

import { createContext, useContext } from "react";
import type { Session } from "./types";

interface AuthContextValue {
  session: Session | null;
  setSession: (value: Session | null) => void;
}

export const AuthContext = createContext<AuthContextValue>({
  session: null,
  setSession: () => undefined,
});

export const useAuth = () => useContext(AuthContext);
