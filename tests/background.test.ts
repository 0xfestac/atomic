import { describe, expect, it, vi, beforeEach } from "vitest";

const afterMock = vi.hoisted(() => vi.fn());
vi.mock("next/server", () => ({ after: afterMock }));

import { afterResponse } from "@/lib/atomic/onchain/background";

describe("afterResponse", () => {
  beforeEach(() => {
    afterMock.mockReset();
  });

  it("registers the task with after() for post-response execution", () => {
    const task = Promise.resolve(1);
    afterResponse(task);
    expect(afterMock).toHaveBeenCalledTimes(1);
    // the registered callback is the task itself, so Next awaits it
    expect(afterMock.mock.calls[0][0]()).toBe(task);
  });

  it("falls back to fire-and-forget when after() is outside a request scope", async () => {
    afterMock.mockImplementation(() => {
      throw new Error("after() was called outside a request scope");
    });
    const task = Promise.reject(new Error("rpc down"));
    // must not throw, and the rejection must be handled (an unhandled
    // rejection fails the test run)
    expect(() => afterResponse(task)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});
