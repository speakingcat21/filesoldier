import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run every 15 minutes to clean up expired files
crons.interval(
    "delete-expired",
    { minutes: 15 },
    internal.files.deleteExpired
);

export default crons;
