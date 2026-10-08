// The worker's text: what they need to show up, plain, one piece (feature 8c, decision 4).

import { describe, expect, test } from "vitest";

import { renderWorkerText, type WorkerTextFactsType } from "./render-worker-text.js";
import { textPieceLength } from "./text-piece-length.js";

const ONE_PIECE = 160;
const PLAIN = /^[\x20-\x5f\x61-\x7e]*$/; // printable ASCII without the backtick

const pedrosEstimate: WorkerTextFactsType = {
  businessName: "Summit Painting",
  startsAt: new Date("2026-10-13T13:30:00Z"), // Tuesday 7:30 in Edmonton
  timezone: "America/Edmonton",
  customerName: "Jane Doe",
  serviceName: "Interior estimate",
  placeName: null,
  location: "1234 Long St NW Calgary",
};

describe("renderWorkerText, a booking added to the worker's day", () => {
  test("the business, what happened, the time, the customer, the service and the address", () => {
    expect(renderWorkerText("added", pedrosEstimate)).toBe(
      "Summit Painting: new booking Tue Oct 13, 7:30am. Jane Doe, Interior estimate, 1234 Long St NW Calgary"
    );
  });

  test("the room comes after the service when the service needs one", () => {
    expect(
      renderWorkerText("added", {
        ...pedrosEstimate,
        businessName: "Riverbend Clinic",
        serviceName: "Deep tissue massage",
        placeName: "Room 3 (massage, facials)",
        location: "At the clinic",
      })
    ).toBe(
      "Riverbend Clinic: new booking Tue Oct 13, 7:30am. Jane Doe, Deep tissue massage, Room 3 (massage, facials), At the clinic"
    );
  });

  test("what people typed is made plain, so it never costs a second piece", () => {
    const text = renderWorkerText("added", {
      ...pedrosEstimate,
      customerName: "Zoë O’Brien",
      location: "12 Rue Lumière\nMontréal",
    });
    expect(text).toMatch(PLAIN);
    expect(text).toContain("Zoe O'Brien");
    expect(text).toContain("12 Rue Lumiere Montreal");
  });

  test("a long business name loses words first, and the rest stays whole", () => {
    const text = renderWorkerText("added", {
      ...pedrosEstimate,
      businessName: "Summit Painting and Decorating Contractors of Southern Alberta Ltd",
      location: "1234 Long Street Northwest, Calgary, Alberta T2X 1A1",
    });
    expect(textPieceLength(text)).toBeLessThanOrEqual(ONE_PIECE);
    expect(text).toMatch(/^Summit Painting and Decorating[\w ]*: new booking /);
    expect(text).toContain(
      "Interior estimate, 1234 Long Street Northwest, Calgary, Alberta T2X 1A1"
    );
  });

  const customerName = "Maria Fernanda Gonzalez de la Cruz";
  const longAddress = "Unit 1204, 1234 Long Street Northwest, Calgary, Alberta T2X 1A1, Canada";

  test("once the business name is one word, the address loses words from its end; the service stays whole", () => {
    const serviceName = "Interior and exterior estimate for a whole house with garage";
    const text = renderWorkerText("added", {
      ...pedrosEstimate,
      businessName: "Summit Painting and Decorating",
      customerName,
      serviceName,
      location: longAddress,
    });
    expect(text).toBe(
      `Summit: new booking Tue Oct 13, 7:30am. ${customerName}, ${serviceName}, Unit 1204, 1234 Long`
    );
    expect(textPieceLength(text)).toBeLessThanOrEqual(ONE_PIECE);
  });

  test("once the address is one word, the service loses words from its end; the time and the name never", () => {
    const text = renderWorkerText("added", {
      ...pedrosEstimate,
      businessName: "Summit Painting and Decorating",
      customerName,
      serviceName:
        "Interior and exterior estimate for a whole house with a two car garage and a fence and a deck",
      location: longAddress,
    });
    expect(text).toBe(
      `Summit: new booking Tue Oct 13, 7:30am. ${customerName}, Interior and exterior estimate for a whole house with a two car garage and a, Unit`
    );
    expect(textPieceLength(text)).toBeLessThanOrEqual(ONE_PIECE);
  });

  test("a cut never ends on a joining mark", () => {
    const text = renderWorkerText("added", {
      ...pedrosEstimate,
      customerName: "Maria Fernanda Gonzalez de la Cruz Rodriguez",
      serviceName: "Interior estimate",
      location:
        "Unit 1204, 1234 Long Street Northwest, Calgary, Alberta T2X 1A1, Canada, behind the shop",
    });
    expect(textPieceLength(text)).toBeLessThanOrEqual(ONE_PIECE);
    expect(text).not.toMatch(/[,;:&]$/);
  });

  test("a text that cannot fit even cut to one word each goes whole, in two pieces", () => {
    const customerName = `Jane ${"Bartholomew-Featherstonehaugh ".repeat(5).trim()}`;
    const text = renderWorkerText("added", { ...pedrosEstimate, customerName });
    expect(text).toContain(customerName);
    expect(text).toContain("Tue Oct 13, 7:30am");
    expect(text.endsWith(", Interior, 1234")).toBe(true);
    expect(textPieceLength(text)).toBeGreaterThan(ONE_PIECE);
  });
});

describe("renderWorkerText, a booking moved or taken off the worker's day", () => {
  test("a move says the new time, with where to go", () => {
    expect(renderWorkerText("moved", pedrosEstimate)).toBe(
      "Summit Painting: moved to Tue Oct 13, 7:30am. Jane Doe, Interior estimate, 1234 Long St NW Calgary"
    );
  });

  test("off their day says the time they had, with no room or address: they no longer go", () => {
    expect(
      renderWorkerText("removed", { ...pedrosEstimate, placeName: "Room 3 (massage, facials)" })
    ).toBe("Summit Painting: off your day, Tue Oct 13, 7:30am. Jane Doe, Interior estimate");
  });
});
