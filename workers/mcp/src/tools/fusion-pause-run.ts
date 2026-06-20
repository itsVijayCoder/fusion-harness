export const pauseRunTool = {
  name: "fusion.pause_run",
  description: "Pause queued work for a Fusion Harness run. Active local agent work is not killed; use cancel to stop the process.",
  inputSchema: {
    type: "object",
    properties: {
      run_id: { type: "string" },
    },
    required: ["run_id"],
  },
} as const;
