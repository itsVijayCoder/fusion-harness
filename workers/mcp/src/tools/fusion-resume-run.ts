export const resumeRunTool = {
  name: "fusion.resume_run",
  description: "Resume a paused Fusion Harness run.",
  inputSchema: {
    type: "object",
    properties: {
      run_id: { type: "string" },
    },
    required: ["run_id"],
  },
} as const;
