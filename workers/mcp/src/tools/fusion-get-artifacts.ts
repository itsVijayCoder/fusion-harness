export const getArtifactsTool = {
  name: "fusion.get_artifacts",
  description: "List artifacts, patches, logs, and transcripts for a openFusion run.",
  inputSchema: {
    type: "object",
    properties: {
      run_id: { type: "string" },
    },
    required: ["run_id"],
  },
} as const;
