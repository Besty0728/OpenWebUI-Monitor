"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

// Cache auth status to avoid repeated checks
let authCache: { isValid: boolean; lastChecked: number } | null = null;
const AUTH_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// DB init flag to prevent multiple initializations
let dbInitialized = false;

export default function AuthCheck({ children }: { children: React.ReactNode }) {
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();
  const checkingRef = useRef(false);

  // Initialize DB only once
  useEffect(() => {
    if (dbInitialized) return;
    
    const initDb = async () => {
      try {
        dbInitialized = true;
        await fetch("/api/init");
      } catch (error) {
        console.error("初始化数据库失败:", error);
        dbInitialized = false;
      }
    };

    initDb();
  }, []);

  const checkAuth = useCallback(async () => {
    // Skip if on token page or status page (public pages)
    if (pathname === "/token" || pathname === "/status") {
      setIsLoading(false);
      setIsAuthorized(true);
      return;
    }

    // Prevent concurrent auth checks
    if (checkingRef.current) return;

    // Check cache first
    const now = Date.now();
    if (authCache && authCache.isValid && (now - authCache.lastChecked) < AUTH_CACHE_TTL) {
      setIsAuthorized(true);
      setIsLoading(false);
      return;
    }

    const token = localStorage.getItem("access_token");
    if (!token) {
      authCache = null;
      router.push("/token");
      return;
    }

    checkingRef.current = true;
    
    try {
      const res = await fetch("/api/v1/config", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        localStorage.removeItem("access_token");
        authCache = null;
        router.push("/token");
        return;
      }

      // Cache successful auth
      authCache = { isValid: true, lastChecked: Date.now() };
      setIsAuthorized(true);
    } catch (error) {
      localStorage.removeItem("access_token");
      authCache = null;
      router.push("/token");
    } finally {
      setIsLoading(false);
      checkingRef.current = false;
    }
  }, [router, pathname]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading || !isAuthorized) {
    return null;
  }

  return <>{children}</>;
}
