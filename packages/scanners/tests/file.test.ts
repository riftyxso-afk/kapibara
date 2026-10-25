import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { ScanError, scanSensitiveFile, scanSensitiveFiles } from "@kapibara/scanners";

const FAKE_OPENAI = "sk-fileFAKE1234567890abcdef";
const tempDirs: string[] = [];

async function tempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), `kapibara-scan-${prefix}-`));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe("scanSensitiveFile", () => {
  it("scans an explicit file inside the workspace", async () => {
    const cwd = await tempDir("inside");
    await writeFile(join(cwd, "secret.txt"), `OPENAI_API_KEY=${FAKE_OPENAI}\n`);

    const result = await scanSensitiveFile("secret.txt", { cwd });

    expect(result.source).toBe("secret.txt");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.type).toBe("openai_api_key");
    expect(JSON.stringify(result)).not.toContain(FAKE_OPENAI);
  });

  it("refuses to scan outside the workspace", async () => {
    const root = await tempDir("outside");
    const cwd = join(root, "project");
    await mkdir(cwd, { recursive: true });
    await writeFile(join(root, "outside.txt"), `OPENAI_API_KEY=${FAKE_OPENAI}\n`);

    await expect(scanSensitiveFile("../outside.txt", { cwd })).rejects.toMatchObject({
      name: "ScanError",
      code: "outside_workspace",
    });
  });

  it("skips binary files", async () => {
    const cwd = await tempDir("binary");
    await writeFile(join(cwd, "image.bin"), Buffer.from([0, 1, 2, 3, 0, 4]));

    const result = await scanSensitiveFile("image.bin", { cwd });

    expect(result.findings).toEqual([]);
    expect(result.skippedReason).toBe("binary");
  });

  it("reports a missing file with a typed error", async () => {
    const cwd = await tempDir("missing");
    const error = await scanSensitiveFile("missing.txt", { cwd }).catch(
      (caught: unknown) => caught,
    );

    expect(error).toBeInstanceOf(ScanError);
    expect((error as ScanError).code).toBe("not_found");
  });

  it("truncates large files at the configured limit", async () => {
    const cwd = await tempDir("large");
    await writeFile(join(cwd, "large.txt"), "a".repeat(5_000));

    const result = await scanSensitiveFile("large.txt", { cwd, maxBytes: 100 });

    expect(result.truncated).toBe(true);
    expect(result.scannedBytes).toBe(100);
  });

  it("rejects directories", async () => {
    const cwd = await tempDir("directory");
    await mkdir(join(cwd, "src"));

    await expect(scanSensitiveFile("src", { cwd })).rejects.toMatchObject({
      code: "not_a_file",
    });
  });
});

describe("scanSensitiveFiles", () => {
  it("scans multiple explicit files", async () => {
    const cwd = await tempDir("multiple");
    await writeFile(join(cwd, "a.txt"), `OPENAI_API_KEY=${FAKE_OPENAI}\n`);
    await writeFile(join(cwd, "b.txt"), "nothing to see here\n");

    const results = await scanSensitiveFiles(["a.txt", "b.txt"], { cwd });

    expect(results).toHaveLength(2);
    expect(results[0]?.findings).toHaveLength(1);
    expect(results[1]?.findings).toEqual([]);
  });

  it("refuses a list larger than maxFiles", async () => {
    const cwd = await tempDir("too-many");

    await expect(
      scanSensitiveFiles(["a.txt", "b.txt"], { cwd, maxFiles: 1 }),
    ).rejects.toMatchObject({ code: "too_many_files" });
  });
});
