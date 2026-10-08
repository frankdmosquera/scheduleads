// A real HTTP server on a free port, with a request held open the way a booking's save is.

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { afterEach, describe, expect, test } from "vitest";

import { stopGracefully } from "./stop-gracefully.js";

let server: Server | undefined;
let finishRequest = () => {};

afterEach(() => {
  finishRequest(); // a failed test still lets its request end
  server?.closeAllConnections();
});

// A server whose one request answers only when the test lets it.
async function serverWithARequestInFlight() {
  const requestArrived = new Promise<void>((arrived) => {
    server = createServer((_request, response) => {
      arrived();
      finishRequest = () => response.end("booked");
    });
  });
  await new Promise<void>((listening) => server!.listen(0, "127.0.0.1", listening));
  const { port } = server!.address() as AddressInfo;
  const answer = fetch(`http://127.0.0.1:${port}/`).then((response) => response.text());
  await requestArrived;
  return { answer, port };
}

describe("stopping the API", () => {
  test("a request already being answered finishes before the API stops", async () => {
    const { answer } = await serverWithARequestInFlight();
    let stopped = false;
    const stopping = stopGracefully(server!, null, "SIGTERM", 5_000).then((how) => {
      stopped = true;
      return how;
    });

    await new Promise((wait) => setTimeout(wait, 100));
    expect(stopped).toBe(false); // still waiting for the request
    finishRequest();

    expect(await answer).toBe("booked");
    expect(await stopping).toBe("finished");
  });

  test("a new request is refused once stopping has begun", async () => {
    const { answer, port } = await serverWithARequestInFlight();
    const stopping = stopGracefully(server!, null, "SIGTERM", 5_000);

    await expect(fetch(`http://127.0.0.1:${port}/`)).rejects.toThrow();
    finishRequest();
    await answer;
    expect(await stopping).toBe("finished");
  });

  test("the jobs in hand are stopped with the same signal, and waited for", async () => {
    server = createServer();
    await new Promise<void>((listening) => server!.listen(0, "127.0.0.1", listening));
    let finishJobs = () => {};
    const stops: (string | undefined)[] = [];
    const runner = {
      stop: (reason?: string) => {
        stops.push(reason);
        return new Promise<void>((done) => (finishJobs = done));
      },
    };
    let stopped = false;
    const stopping = stopGracefully(server, runner, "SIGTERM", 5_000).then(() => (stopped = true));

    await new Promise((wait) => setTimeout(wait, 100));
    expect(stops).toEqual(["SIGTERM"]);
    expect(stopped).toBe(false);
    finishJobs();
    await stopping;
    expect(stopped).toBe(true);
  });

  test("a request that never ends lets the API stop at the limit", async () => {
    await serverWithARequestInFlight();

    expect(await stopGracefully(server!, null, "SIGTERM", 200)).toBe("timed_out");
  });
});
