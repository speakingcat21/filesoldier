import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

/**
 * better-auth API route handler
 * Handles all auth endpoints: /api/auth/*
 * 
 * Endpoints:
 * - POST /api/auth/sign-up
 * - POST /api/auth/sign-in/email
 * - POST /api/auth/sign-out
 * - GET /api/auth/session
 */
export const { GET, POST } = toNextJsHandler(auth);
