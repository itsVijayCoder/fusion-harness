export const deleteRunTool = {
  name: "fusion.delete_run",
  description: "Delete a Fusion Harness run. If the run is active, it is stopped before deletion.",
  inputSchema: {
    type: "object",
    properties: {
      run_id: { type: "string" },
    },
    required: ["run_id"],
  },
} as const;
