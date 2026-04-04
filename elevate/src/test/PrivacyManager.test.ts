import * as assert from "assert";
import { buildExportPayload } from "../backend/PrivacyManager";
import { isValidJobId, partitionJobsByRetention } from "../backend/JobStore";
import { JobRecord, JobStatus } from "../backend/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeJob(overrides: Partial<JobRecord> = {}): JobRecord {
  return {
    job_id: "test-job-1",
    type: "OLLAMA_CHAT",
    priority: 5,
    model: "llama3.2:3b",
    status: JobStatus.SUCCEEDED,
    version: 1,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:01.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// isValidJobId — path-traversal guard
// ---------------------------------------------------------------------------

suite("isValidJobId", () => {
  test("accepts a standard UUID", () => {
    assert.strictEqual(isValidJobId("550e8400-e29b-41d4-a716-446655440000"), true);
  });

  test("accepts alphanumeric-only id", () => {
    assert.strictEqual(isValidJobId("abc123"), true);
  });

  test("accepts underscores and hyphens", () => {
    assert.strictEqual(isValidJobId("job_abc-123"), true);
  });

  test("rejects path traversal with ../", () => {
    assert.strictEqual(isValidJobId("../../etc/passwd"), false);
  });

  test("rejects path traversal with forward slash", () => {
    assert.strictEqual(isValidJobId("foo/bar"), false);
  });

  test("rejects empty string", () => {
    assert.strictEqual(isValidJobId(""), false);
  });

  test("rejects id longer than 128 chars", () => {
    assert.strictEqual(isValidJobId("a".repeat(129)), false);
  });

  test("accepts id exactly 128 chars", () => {
    assert.strictEqual(isValidJobId("a".repeat(128)), true);
  });

  test("rejects null byte", () => {
    assert.strictEqual(isValidJobId("foo\0bar"), false);
  });

  test("rejects spaces", () => {
    assert.strictEqual(isValidJobId("job id"), false);
  });
});

// ---------------------------------------------------------------------------
// buildExportPayload — pure data shaping
// ---------------------------------------------------------------------------

suite("buildExportPayload", () => {
  test("sets exported_at to provided timestamp", () => {
    const ts = "2026-03-31T12:00:00.000Z";
    const payload = buildExportPayload([], new Map(), ts);
    assert.strictEqual(payload.exported_at, ts);
  });

  test("reports correct total_jobs count", () => {
    const jobs = [makeJob({ job_id: "a" }), makeJob({ job_id: "b" })];
    const payload = buildExportPayload(jobs, new Map(), "2026-01-01T00:00:00.000Z");
    assert.strictEqual(payload.total_jobs, 2);
  });

  test("attaches result_text_content from map", () => {
    const job = makeJob({ job_id: "j1" });
    const texts = new Map([["j1", "some analysis output"]]);
    const payload = buildExportPayload([job], texts, "2026-01-01T00:00:00.000Z");
    assert.strictEqual(payload.jobs[0].result_text_content, "some analysis output");
  });

  test("sets result_text_content to null when not in map", () => {
    const job = makeJob({ job_id: "j2" });
    const payload = buildExportPayload([job], new Map(), "2026-01-01T00:00:00.000Z");
    assert.strictEqual(payload.jobs[0].result_text_content, null);
  });

  test("sets result_text_content to null when map value is null", () => {
    const job = makeJob({ job_id: "j3" });
    const texts = new Map<string, string | null>([["j3", null]]);
    const payload = buildExportPayload([job], texts, "2026-01-01T00:00:00.000Z");
    assert.strictEqual(payload.jobs[0].result_text_content, null);
  });

  test("preserves all job fields in output", () => {
    const job = makeJob({ job_id: "j4", model: "mistral:7b", priority: 9 });
    const payload = buildExportPayload([job], new Map(), "2026-01-01T00:00:00.000Z");
    const out = payload.jobs[0];
    assert.strictEqual(out.job_id, "j4");
    assert.strictEqual(out.model, "mistral:7b");
    assert.strictEqual(out.priority, 9);
  });

  test("includes local-only privacy note", () => {
    const payload = buildExportPayload([], new Map(), "2026-01-01T00:00:00.000Z");
    assert.ok(payload.note.length > 0);
    assert.ok(payload.note.toLowerCase().includes("local"));
  });

  test("handles empty job list", () => {
    const payload = buildExportPayload([], new Map(), "2026-01-01T00:00:00.000Z");
    assert.strictEqual(payload.total_jobs, 0);
    assert.deepStrictEqual(payload.jobs, []);
  });
});

// ---------------------------------------------------------------------------
// partitionJobsByRetention — pruning logic
// ---------------------------------------------------------------------------

suite("partitionJobsByRetention", () => {
  const CUTOFF = new Date("2026-03-01T00:00:00.000Z").getTime();

  test("prunes jobs older than the cutoff", () => {
    const old = makeJob({ job_id: "old", created_at: "2026-01-01T00:00:00.000Z" });
    const { keep, prune } = partitionJobsByRetention([old], CUTOFF);
    assert.strictEqual(prune.length, 1);
    assert.strictEqual(keep.length, 0);
    assert.strictEqual(prune[0].job_id, "old");
  });

  test("keeps jobs newer than the cutoff", () => {
    const recent = makeJob({ job_id: "recent", created_at: "2026-04-01T00:00:00.000Z" });
    const { keep, prune } = partitionJobsByRetention([recent], CUTOFF);
    assert.strictEqual(keep.length, 1);
    assert.strictEqual(prune.length, 0);
  });

  test("keeps jobs exactly at the cutoff", () => {
    const exact = makeJob({ job_id: "exact", created_at: new Date(CUTOFF).toISOString() });
    const { keep, prune } = partitionJobsByRetention([exact], CUTOFF);
    assert.strictEqual(keep.length, 1);
    assert.strictEqual(prune.length, 0);
  });

  test("keeps jobs with unparseable created_at to avoid accidental loss", () => {
    const bad = makeJob({ job_id: "bad-date", created_at: "not-a-date" });
    const { keep, prune } = partitionJobsByRetention([bad], CUTOFF);
    assert.strictEqual(keep.length, 1);
    assert.strictEqual(prune.length, 0);
  });

  test("splits a mixed list correctly", () => {
    const jobs = [
      makeJob({ job_id: "old1", created_at: "2026-01-01T00:00:00.000Z" }),
      makeJob({ job_id: "old2", created_at: "2026-02-01T00:00:00.000Z" }),
      makeJob({ job_id: "new1", created_at: "2026-04-01T00:00:00.000Z" }),
    ];
    const { keep, prune } = partitionJobsByRetention(jobs, CUTOFF);
    assert.strictEqual(prune.length, 2);
    assert.strictEqual(keep.length, 1);
    assert.strictEqual(keep[0].job_id, "new1");
  });

  test("returns empty arrays for empty input", () => {
    const { keep, prune } = partitionJobsByRetention([], CUTOFF);
    assert.deepStrictEqual(keep, []);
    assert.deepStrictEqual(prune, []);
  });
});
