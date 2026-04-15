"use client";

import * as React from "react";

export type UserRole = "ADMIN" | "OPERATOR";

type JwtPayload = {
  tenantId?: string;
  userId?: string;
  role?: UserRole;
  exp?: number;
};

export type AuthSession = {
  token: string;
  tenantId: string;
  tenantName: string;
  userId: string;
  userName: string;
  role: UserRole;
  expiresAt: number | null;
};

type AuthState = {
  hydrated: boolean;
  token: string | null;
  tenantId: string | null;
  tenantName: string | null;
  userId: string | null;
  userName: string | null;
  role: UserRole | null;
  expiresAt: number | null;
};

const STORAGE_KEY = "compra_de_ouro.auth.session";

const defaultState: AuthState = {
  hydrated: false,
  token: null,
  tenantId: null,
  tenantName: null,
  userId: null,
  userName: null,
  role: null,
  expiresAt: null
};

const isClearedState = (value: AuthState) =>
  !value.token && !value.tenantId && !value.tenantName && !value.userId && !value.userName && !value.role && !value.expiresAt;

let state: AuthState = { ...defaultState };
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) {
    listener();
  }
};

const setState = (partial: Partial<AuthState>) => {
  state = { ...state, ...partial };
  notify();
};

const decodeJwtPayload = (token: string): JwtPayload | null => {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return null;
    }

    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const normalized = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const json = atob(normalized);
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
};

const persistSession = (next: AuthState) => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!next.token || !next.tenantId) {
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    const payload: AuthSession = {
      token: next.token,
      tenantId: next.tenantId,
      tenantName: next.tenantName ?? next.tenantId,
      userId: next.userId ?? "",
      userName: next.userName ?? "",
      role: next.role ?? "OPERATOR",
      expiresAt: next.expiresAt
    };

    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore storage failures.
  }
};

const applySession = (session: AuthSession | null) => {
  if (!session) {
    if (state.hydrated && isClearedState(state)) {
      return;
    }

    setState({
      hydrated: true,
      token: null,
      tenantId: null,
      tenantName: null,
      userId: null,
      userName: null,
      role: null,
      expiresAt: null
    });
    persistSession({ ...defaultState, hydrated: true });
    return;
  }

  const payload = decodeJwtPayload(session.token);
  const tenantId = payload?.tenantId ?? session.tenantId;
  const userId = payload?.userId ?? session.userId;
  const role = payload?.role ?? session.role;
  const expiresAt = payload?.exp ? payload.exp * 1000 : session.expiresAt;

  setState({
    hydrated: true,
    token: session.token,
    tenantId,
    tenantName: session.tenantName || tenantId,
    userId,
    userName: session.userName,
    role,
    expiresAt: expiresAt ?? null
  });

  persistSession({ ...state });
};

export const hydrateAuthStore = () => {
  if (state.hydrated) {
    return;
  }

  if (typeof window === "undefined") {
    setState({ hydrated: true });
    return;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      if (!state.hydrated) {
        setState({ hydrated: true });
      }
      return;
    }

    const parsed = JSON.parse(raw) as AuthSession;
    applySession(parsed);
  } catch {
    if (!state.hydrated) {
      setState({ hydrated: true });
    }
  }
};

export const setAuthSession = (session: AuthSession) => {
  applySession(session);
};

export const clearAuthSession = () => {
  applySession(null);
};

export const getAuthSnapshot = (): AuthState => state;

export const hasValidSession = () => {
  const snapshot = getAuthSnapshot();
  if (!snapshot.token || !snapshot.tenantId) {
    return false;
  }

  if (!snapshot.expiresAt) {
    return true;
  }

  return snapshot.expiresAt > Date.now();
};

export const subscribeAuthStore = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useAuthStore = () => {
  const snapshot = React.useSyncExternalStore(subscribeAuthStore, getAuthSnapshot, getAuthSnapshot);

  React.useEffect(() => {
    hydrateAuthStore();
  }, []);

  return {
    ...snapshot,
    isAuthenticated: hasValidSession(),
    setAuthSession,
    clearAuthSession
  };
};
