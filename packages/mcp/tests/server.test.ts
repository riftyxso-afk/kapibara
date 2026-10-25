import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";

import { createKapibaraServer, type KapibaraServerOptions } from "@kapibara/mcp";

const FAKE_SECRET = "sk-serverFAKE1234567890abcd";
const tempDirs: string[] = [];

interface Harness {
  client: Client;
  close: () => Promise<void>;
}

async function workspace(): Promise<{ cwd: string; homeDir: string }> {
  const cwd = await mkdtemp(join(tmpdir(), "kapibara-server-cwd-"));
  const homeDir = await mkdtemp(join(tmpdir(), "kapibara-server-home-"));
  tempDirs.push(cwd, homeDir);
  return { cwd, homeDir };
}

async function connect(options: KapibaraServerOptions = {}): Promise<Harness> {
  const server = createKapibaraServer(options);
  const client = new Client({ name: "kapibara-test-client", version: "0.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);

  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("Kapibara MCP server", () => {
  it("registers exactly the five Kapibara tools", async () => {
    const { cwd, homeDir } = await workspace();
    const { client, close } = await connect({ cwd, homeDir });

    try {
      const { tools } = await client.listTools();
      const names = tools.map((tool) => tool.name).sort();

      expect(names).toEqual([
        "kapibara_action_risk",
        "kapibara_compare",
        "kapibara_preflight",
        "kapibara_rules_check",
        "kapibara_scan_sensitive",
      ]);
      for (const tool of tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.inputSchema).toBeDefined();
        expect(tool.outputSchema).toBeDefined();
        expect(tool.annotations?.readOnlyHint).toBe(true);
        expect(tool.annotations?.destructiveHint).toBe(false);
        expect(tool.annotations?.openWorldHint).toBe(false);
      }
    } finally {
      await close();
    }
  });

  it("returns structured content for kapibara_preflight", async () => {
    const { cwd, homeDir } = await workspace();
    const { client, close } = await connect({ cwd, homeDir });

    try {
      const result = await client.callTool({
        name: "kapibara_preflight",
        arguments: {
          action: "force push",
          target: "origin/main",
          context: { metadata: { branch: "main" } },
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        data: {
          result: { decision: "block" },
        },
      });
      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content[0]?.type).toBe("text");
      expect(content[0]?.text).toContain("Decision: BLOCK");
    } finally {
      await close();
    }
  });

  it("redacts secrets returned by kapibara_scan_sensitive", async () => {
    const { cwd, homeDir } = await workspace();
    const { client, close } = await connect({ cwd, homeDir });

    try {
      const result = await client.callTool({
        name: "kapibara_scan_sensitive",
        arguments: { text: `OPENAI_API_KEY=${FAKE_SECRET}` },
      });

      expect(result.isError).toBeFalsy();
      expect(JSON.stringify(result)).not.toContain(FAKE_SECRET);
      expect(result.structuredContent).toMatchObject({
        data: { counts: { total: 1, bySeverity: { critical: 1 } } },
      });
    } finally {
      await close();
    }
  });

  it("serves kapibara_action_risk", async () => {
    const { cwd, homeDir } = await workspace();
    const { client, close } = await connect({ cwd, homeDir });

    try {
      const result = await client.callTool({
        name: "kapibara_action_risk",
        arguments: { action: "delete database", target: "production" },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        data: { decision: "require_approval" },
      });
    } finally {
      await close();
    }
  });

  it("serves kapibara_compare", async () => {
    const { cwd, homeDir } = await workspace();
    const { client, close } = await connect({ cwd, homeDir });

    try {
      const result = await client.callTool({
        name: "kapibara_compare",
        arguments: {
          sources: [
            { name: "a", content: "Total: $10" },
            { name: "b", content: "Total: $20" },
          ],
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({ data: { matches: false } });
    } finally {
      await close();
    }
  });

  it("serves kapibara_rules_check with a profile override", async () => {
    const { cwd, homeDir } = await workspace();
    const { client, close } = await connect({ cwd, homeDir });

    try {
      const result = await client.callTool({
        name: "kapibara_rules_check",
        arguments: {
          action: "git push",
          target: "origin/feature",
          profile: "strict",
        },
      });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toMatchObject({
        data: { decision: "require_approval", profile: "strict" },
      });
    } finally {
      await close();
    }
  });

  it("rejects invalid tool input", async () => {
    const { cwd, homeDir } = await workspace();
    const { client, close } = await connect({ cwd, homeDir });

    try {
      const missingAction = await client.callTool({
        name: "kapibara_preflight",
        arguments: {},
      });
      expect(missingAction.isError).toBe(true);
      expect(JSON.stringify(missingAction.content)).toContain("Input validation error");

      const emptySources = await client.callTool({
        name: "kapibara_compare",
        arguments: { sources: [] },
      });
      expect(emptySources.isError).toBe(true);
      expect(JSON.stringify(emptySources.content)).toContain("Input validation error");
    } finally {
      await close();
    }
  });

  it("marks scan errors as tool errors without structured content", async () => {
    const { cwd, homeDir } = await workspace();
    const { client, close } = await connect({ cwd, homeDir });

    try {
      const result = await client.callTool({
        name: "kapibara_scan_sensitive",
        arguments: { path: "missing.txt" },
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      const content = result.content as Array<{ type: string; text?: string }>;
      expect(content[0]?.text).toContain("not found");
    } finally {
      await close();
    }
  });
});
