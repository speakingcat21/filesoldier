import { httpRouter } from "convex/server";
import { authComponent, createAuth } from "./auth";

const http = httpRouter();

// Register Better Auth routes with CORS enabled for cross-origin requests
authComponent.registerRoutes(http, createAuth, {
    cors: {
        allowedOrigins: [
            "http://localhost:5173",
            "http://localhost:5174",
            "http://localhost:5175",
            "http://localhost:3000",
            process.env.SITE_URL || "",
        ].filter(Boolean),
        allowedHeaders: ["content-type", "authorization", "x-requested-with"],
        exposedHeaders: ["set-cookie"],
    },
});

export default http;
