import { after } from "next/server";

/**
 * Hand background cache-refresh work to Next's after() so a
 * stale-while-revalidate refresh is guaranteed to run to completion even
 * on serverless runtimes that freeze the isolate once the response is
 * flushed. Outside a request scope (tests, module init) after() throws —
 * the task then simply continues as a fire-and-forget promise. Server-only:
 * importing next/server from anything reachable by a client bundle breaks
 * the webpack build.
 */
export function afterResponse<T>(task: Promise<T>): void {
  task.catch(() => {}); // never leave a refresh rejection unhandled
  try {
    after(() => task);
  } catch {
    // no request scope: the fire-and-forget continuation above is enough
  }
}
