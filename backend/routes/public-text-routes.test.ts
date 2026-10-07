// A customer's text reply, from Twilio's post to the business's phone and inbox (feature 8b),
// against the local database with Twilio and Resend faked: no test reaches either. Posts are signed
// the way Twilio signs them (proved against Twilio's own example in
// verify-twilio-signature.test.ts). Every business here is a throwaway carrying this run's tag.

import { createHmac, randomBytes, randomInt, randomUUID } from "node:crypto";

import { like, sql } from "drizzle-orm";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { assertLocalDevDatabase } from "@scheduleads-app/shared/assert-local-dev-database";

try {
  process.loadEnvFile(new URL("../../.env", import.meta.url)); // the root .env, before the app reads it
} catch {
  // No .env: the environment must already carry DATABASE_URL and the token key.
}

assertLocalDevDatabase(process.env.DATABASE_URL, "run the text reply route tests");

// Imported after the env is loaded: they read it the moment they load.
const { app } = await import("../app.js");
const { db } = await import("../database.js");
const { contact, emailSendingKey, lead, organization, pipelineStage, textSettings } =
  await import("@scheduleads-app/shared/db");
const { encryptCredentials, readTokenKey } = await import("@scheduleads-app/shared/crypto");
const { apiOrigin } = await import("../lib/auth/auth-server.js");
const { jobSchema } = await import("../lib/jobs/job-schema.js");
const { workDueJobs } = await import("../lib/jobs/work-due-jobs.js");

const tag = randomUUID().slice(0, 8);
const TOKEN = "test-auth-token";
const ACCOUNT = "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages";
const JANE = "+14035550148";
const schema = sql.identifier(jobSchema);

const madeUpNumber = () =>
  `+1587${randomInt(200, 1000)}${String(randomInt(0, 10_000)).padStart(4, "0")}`;
const messageSid = () => `SM${randomBytes(16).toString("hex")}`;

// A business that texts from its own number and passes replies where `settings` say. Jane is on
// one of its leads, so she is named.
async function makeBusiness(name: string, settings: Record<string, unknown> = {}) {
  const business = randomUUID();
  await db.insert(organization).values({
    id: business,
    name: "Summit Painting",
    slug: `test-textreply-${name}-${tag}-dev`,
    senderEmail: "bookings@summitpainting.com",
    notifyEmail: "office@summitpainting.com",
  });
  await db.insert(emailSendingKey).values({
    organizationId: business,
    credentials: encryptCredentials("re_summit_send_key", readTokenKey(), business),
  });
  const stage = randomUUID();
  await db
    .insert(pipelineStage)
    .values({ id: stage, organizationId: business, name: "New", position: 0 });
  const jane = randomUUID();
  await db.insert(contact).values({ id: jane, organizationId: business, name: "Jane Doe" });
  await db.insert(lead).values({
    id: randomUUID(),
    organizationId: business,
    contactId: jane,
    stageId: stage,
    source: "widget",
    phone: "(403) 555-0148",
  });
  const fromNumber = madeUpNumber();
  const replyPhone = madeUpNumber();
  await db.insert(textSettings).values({
    organizationId: business,
    fromNumber,
    confirmationOn: true,
    reminderMinutesBefore: [],
    replyPhone,
    replyEmail: null,
    ...settings,
  });
  return { business, fromNumber, replyPhone };
}

type BusinessType = Awaited<ReturnType<typeof makeBusiness>>;

// Twilio's side and Resend's, faked: the texts Twilio holds, every request, and its answers.
type CallType = { method: string; url: string; form: Record<string, string> };
let calls: CallType[];
let held: Map<string, { from: string; to: string; body: string; num_media: string }>;

// Signs a post exactly as Twilio does, for the API's own address.
function signed(fields: Record<string, string>, address = `${apiOrigin}/texts/incoming`) {
  const data = Object.keys(fields)
    .sort()
    .reduce((text, name) => text + name + fields[name], address);
  return createHmac("sha1", TOKEN).update(data, "utf8").digest("base64");
}

// Jane's text, as Twilio keeps it and posts it.
function janeTexts(business: BusinessType, body: string, from = JANE, pictures = 0) {
  const sid = messageSid();
  held.set(sid, { from, to: business.fromNumber, body, num_media: String(pictures) });
  return { MessageSid: sid, AccountSid: "AC123", From: from, To: business.fromNumber, Body: body };
}

const post = (fields: Record<string, string>, signature: string | null = signed(fields)) =>
  app.request("/texts/incoming", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(signature ? { "X-Twilio-Signature": signature } : {}),
    },
    body: new URLSearchParams(fields).toString(),
  });

const replyJobs = async () =>
  (await db.execute(
    sql`select jobs.payload from ${schema}._private_jobs jobs
        join ${schema}._private_tasks tasks on tasks.id = jobs.task_id
        where tasks.identifier = 'text_reply'`
  )) as unknown as { payload: { organizationId: string; messageSid: string } }[];

const textsSent = () =>
  calls.filter((call) => call.method === "POST" && call.url.endsWith("/Messages.json"));
const emailsSent = () => calls.filter((call) => call.url === "https://api.resend.com/emails");

// The texts Twilio took, and how it answers the next send: taken ("sent"), taken with the answer
// lost ("lost"), or refused (a Response).
type OutboxTextType = Record<
  "sid" | "from" | "to" | "body" | "direction" | "status" | "date_created",
  string
>;
let outbox: OutboxTextType[];
let sendAnswer: (form: Record<string, string>) => "sent" | "lost" | Response;

let log: ReturnType<typeof vi.spyOn>;
let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  calls = [];
  held = new Map();
  outbox = [];
  sendAnswer = () => "sent";
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC123");
  vi.stubEnv("TWILIO_AUTH_TOKEN", TOKEN);
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    const method = init.method ?? "GET";
    if (url === "https://api.resend.com/emails") {
      calls.push({ method, url, form: JSON.parse(String(init.body)) });
      return Response.json({ id: `email-${calls.length}` });
    }
    if (!url.startsWith(ACCOUNT)) throw new Error(`A test tried to reach ${new URL(url).origin}.`);
    const form =
      method === "POST" ? Object.fromEntries(new URLSearchParams(String(init.body))) : {};
    calls.push({ method, url, form });
    const one = /\/Messages\/(\w+)\.json$/.exec(new URL(url).pathname);
    if (one) {
      const text = held.get(one[1]!);
      return text
        ? Response.json({ ...text, date_created: new Date().toUTCString() })
        : Response.json({ code: 20404, status: 404 }, { status: 404 });
    }
    if (method === "POST") {
      const answer = sendAnswer(form);
      if (answer instanceof Response) return answer; // refused: Twilio keeps nothing
      const sid = `SM-out-${calls.length}`;
      outbox.push({
        sid,
        from: form.From!,
        to: form.To!,
        body: form.Body!,
        direction: "outbound-api",
        status: "sent",
        date_created: new Date().toUTCString(),
      });
      return answer === "sent"
        ? Response.json({ sid }, { status: 201 })
        : new Response("<html>gateway</html>", { status: 201 }); // taken, the answer lost
    }
    const asked = new URL(url).searchParams;
    return Response.json({
      messages: outbox
        .filter((text) => text.to === asked.get("To") && text.from === asked.get("From"))
        .reverse(), // newest first, as Twilio lists them
    });
  });
  log = vi.spyOn(console, "log").mockImplementation(() => {});
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(async () => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  await db.execute(sql`delete from ${schema}._private_jobs`);
});

afterAll(async () => {
  await db.delete(organization).where(like(organization.slug, `test-textreply-%-${tag}-dev`));
  await db.$client.end();
});

const logged = (part: string) =>
  log.mock.calls.some(([line]) => typeof line === "string" && line.includes(part));

describe("a customer's text reply", () => {
  test("a signed post is answered at once and passed on to the reply phone and the reply email", async () => {
    const business = await makeBusiness("both", { replyEmail: "office@summitpainting.com" });
    const fields = janeTexts(business, "Can we make it 8 instead?");

    const response = await post(fields);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/xml");
    expect(await response.text()).toContain("<Response/>");
    expect(await replyJobs()).toEqual([
      { payload: { organizationId: business.business, messageSid: fields.MessageSid } },
    ]);

    await workDueJobs();

    expect(textsSent().map((call) => call.form)).toEqual([
      {
        From: business.fromNumber,
        To: business.replyPhone,
        Body: "Reply from Jane Doe, 403-555-0148: Can we make it 8 instead? (answer at 403-555-0148, not here)",
      },
    ]);
    const [email] = emailsSent();
    expect(emailsSent()).toHaveLength(1);
    expect(email!.form).toMatchObject({
      from: '"Summit Painting" <bookings@summitpainting.com>',
      to: ["office@summitpainting.com"],
      subject: "Text from Jane Doe",
    });
    expect(String(email!.form.text)).toContain("Can we make it 8 instead?");
  });

  test.each([
    ["no signature", (fields: Record<string, string>) => post(fields, null)],
    [
      "a signature for another address",
      (fields: Record<string, string>) =>
        post(fields, signed(fields, "https://evil.example.com/texts/incoming")),
    ],
    [
      "a signature over other words",
      (fields: Record<string, string>) =>
        post({ ...fields, Body: "Cancel everything" }, signed(fields)),
    ],
  ])("a post with %s is refused and saves nothing", async (_, send) => {
    const business = await makeBusiness(`refused-${randomUUID().slice(0, 8)}`);
    const response = await send(janeTexts(business, "Can we make it 8 instead?"));

    expect(response.status).toBe(403);
    expect(await replyJobs()).toEqual([]);
  });

  test("without Twilio keys every post is refused: nothing can check the signature", async () => {
    const business = await makeBusiness("no-keys");
    const fields = janeTexts(business, "Hello?");
    vi.stubEnv("TWILIO_AUTH_TOKEN", "");

    expect((await post(fields)).status).toBe(403);
    expect(await replyJobs()).toEqual([]);
  });

  test("a text to a number no business texts from is answered and saves nothing", async () => {
    const fields = {
      MessageSid: messageSid(),
      From: JANE,
      To: madeUpNumber(),
      Body: "Hello?",
    };

    const response = await post(fields);

    expect(response.status).toBe(200);
    expect(await replyJobs()).toEqual([]);
  });

  test("Twilio posting the same text twice passes it on once", async () => {
    const business = await makeBusiness("twice");
    const fields = janeTexts(business, "Can we make it 8 instead?");

    await post(fields);
    await post(fields);
    expect(await replyJobs()).toHaveLength(1);
    await workDueJobs();

    expect(textsSent()).toHaveLength(1);
  });

  test("a text from the business's own reply phone is never passed on", async () => {
    const business = await makeBusiness("own-phone");
    await post(janeTexts(business, "OK see you at 8", business.replyPhone));

    await workDueJobs();

    expect(textsSent()).toEqual([]);
    expect(logged("it came from the business's own reply phone")).toBe(true);
  });

  test("a reply phone that is a business's texting number gets nothing, and the email still goes", async () => {
    const other = await makeBusiness("other");
    const business = await makeBusiness("loop", {
      replyPhone: other.fromNumber,
      replyEmail: "office@summitpainting.com",
    });
    await post(janeTexts(business, "Can we make it 8 instead?"));

    await workDueJobs();

    expect(textsSent()).toEqual([]);
    expect(emailsSent()).toHaveLength(1);
    expect(logged("the reply phone is a texting number")).toBe(true);
  });

  test("an unknown sender is shown by number, and their words are passed on untouched", async () => {
    const business = await makeBusiness("stranger");
    await post(janeTexts(business, "On my way 👍", "+14035550177"));

    await workDueJobs();

    expect(textsSent().map((call) => call.form.Body)).toEqual([
      "Reply from 403-555-0177: On my way 👍 (answer at 403-555-0177, not here)",
    ]);
  });

  // A failed run waits seconds for its next try; the tests do not wait for it.
  const makeDue = () => db.execute(sql`update ${schema}._private_jobs set run_at = now()`);

  test("a retry after the pass-on's answer was lost sends nothing again", async () => {
    const business = await makeBusiness("lost", { replyEmail: "office@summitpainting.com" });
    let first = true;
    sendAnswer = () => (first ? ((first = false), "lost") : "sent");
    await post(janeTexts(business, "Can we make it 8 instead?"));

    await workDueJobs();
    await makeDue();
    await workDueJobs();

    expect(textsSent()).toHaveLength(1);
    expect(emailsSent()).toHaveLength(2); // the retry's email reuses its key: Resend sends one
    expect(new Set(emailsSent().map((call) => JSON.stringify(call.form)))).toHaveProperty(
      "size",
      1
    );
  });

  test("Twilio posting the same text again after it was passed on sends nothing again", async () => {
    const business = await makeBusiness("again");
    const fields = janeTexts(business, "Can we make it 8 instead?");

    await post(fields);
    await workDueJobs();
    await post(fields);
    await workDueJobs();

    expect(textsSent()).toHaveLength(1);
  });

  test("a text to the reply phone that keeps failing never holds back the email", async () => {
    const business = await makeBusiness("down", { replyEmail: "office@summitpainting.com" });
    sendAnswer = () => Response.json({ code: 21606, status: 400 }, { status: 400 }); // retried
    await post(janeTexts(business, "Can we make it 8 instead?"));

    await workDueJobs();

    expect(emailsSent()).toHaveLength(1);
    expect(await replyJobs()).toHaveLength(1); // the text still waits for its next try
  });

  test("a reply phone refused for good is logged, and the email still goes", async () => {
    const business = await makeBusiness("refused-phone", {
      replyEmail: "office@summitpainting.com",
    });
    sendAnswer = () => Response.json({ code: 21610, status: 400 }, { status: 400 });
    await post(janeTexts(business, "Can we make it 8 instead?"));

    await workDueJobs();

    expect(emailsSent()).toHaveLength(1);
    expect(await replyJobs()).toEqual([]);
    expect(logged("Twilio 21610 for the reply phone")).toBe(true);
  });

  test("a business with only a reply email gets the email and no text", async () => {
    const business = await makeBusiness("email-only", {
      replyPhone: null,
      replyEmail: "office@summitpainting.com",
    });
    await post(janeTexts(business, "Can we make it 8 instead?"));

    await workDueJobs();

    expect(textsSent()).toEqual([]);
    expect(emailsSent()).toHaveLength(1);
  });

  test("a text Twilio says went to another number is never passed on to this business", async () => {
    const business = await makeBusiness("other-number");
    const fields = janeTexts(business, "Can we make it 8 instead?");
    held.get(fields.MessageSid)!.to = madeUpNumber();
    await post(fields);

    await workDueJobs();

    expect(textsSent()).toEqual([]);
    expect(logged("it was sent to another number")).toBe(true);
  });

  test("a picture is said, not passed on", async () => {
    const business = await makeBusiness("picture", { replyEmail: "office@summitpainting.com" });
    await post(janeTexts(business, "", JANE, 1));

    await workDueJobs();

    expect(textsSent().map((call) => call.form.Body)).toEqual([
      "Reply from Jane Doe, 403-555-0148: [picture not shown] (answer at 403-555-0148, not here)",
    ]);
    expect(String(emailsSent()[0]!.form.text)).toContain("They also sent a picture");
  });

  test("a refused post is logged with the address it was checked against", async () => {
    const business = await makeBusiness("logged");
    await post(janeTexts(business, "Hello?"), null);

    expect(
      warn.mock.calls.some(
        ([line]) => typeof line === "string" && line.includes(`${apiOrigin}/texts/incoming refused`)
      )
    ).toBe(true);
  });

  test("STOP is passed on too, so the business knows the customer opted out", async () => {
    const business = await makeBusiness("stop");
    await post({ ...janeTexts(business, "STOP"), OptOutType: "STOP" });

    await workDueJobs();

    expect(textsSent().map((call) => call.form.Body)).toEqual([
      "Reply from Jane Doe, 403-555-0148: STOP (answer at 403-555-0148, not here)",
    ]);
  });
});
