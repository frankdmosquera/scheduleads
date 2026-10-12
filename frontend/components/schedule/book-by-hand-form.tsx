// Frontend component: booking by hand on the Calendar page (feature 12b), a phone estimate or a
// walk-in, for the person shown. Any time nobody it needs is busy, inside bookable hours or not;
// the API checks it and makes the same booking a website booking makes.

"use client";

import { useEffect, useState } from "react";

import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { bookByHand } from "@/lib/api-client/schedule/book-by-hand";
import {
  fetchServicesSettings,
  type ServiceSettingsType,
} from "@/lib/api-client/settings/fetch-services-settings";
import { calendarDayWords } from "@/lib/calendar-day-words";

export function BookByHandForm({
  personId,
  dates,
  onBooked,
}: {
  personId: string;
  dates: string[]; // the week shown, YYYY-MM-DD
  onBooked: () => void; // the week reads again, showing the booking
}) {
  const [services, setServices] = useState<ServiceSettingsType[] | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [date, setDate] = useState(dates[0]);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<SaveNoticeType>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    fetchServicesSettings().then((result) => {
      if (!live) return;
      // The live services this person does: ticked, or nobody ticked, which means anyone.
      const theirs =
        result.state === "ok"
          ? result.answer.services.filter(
              (service) =>
                service.active &&
                (service.peopleIds.length === 0 || service.peopleIds.includes(personId))
            )
          : [];
      setServices(theirs);
      setServiceId((current) => current || theirs[0]?.id || "");
    });
    return () => {
      live = false;
    };
  }, [personId]);

  const service = services?.find((one) => one.id === serviceId) ?? null;
  const edited = () => {
    setErrors({});
    setNotice(null);
  };

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const [hours, minutes] = time.split(":").map(Number);
    if (!time || Number.isNaN(hours)) {
      setErrors({ startMinute: "Pick a time." });
      return;
    }
    setSaving(true);
    const saved = await bookByHand({
      bookingLinkId: serviceId,
      personId,
      date,
      startMinute: hours * 60 + minutes,
      customer: {
        name,
        ...(phone.trim() ? { phone } : {}),
        ...(email.trim() ? { email } : {}),
      },
      ...(address.trim() && service?.addressMode !== "not_asked" ? { location: address } : {}),
      ...(note.trim() ? { details: note } : {}),
    });
    setSaving(false);
    if (saved.state === "ok") {
      const reachable = Boolean(phone.trim() || email.trim());
      setName("");
      setPhone("");
      setEmail("");
      setAddress("");
      setNote("");
      setTime("");
      setNotice({
        tone: "info",
        text: reachable
          ? "Booked. The customer hears as your settings say."
          : "Booked. With no phone or email, the customer hears nothing from us.",
      });
      onBooked();
      return;
    }
    if (saved.state === "field") setErrors({ [saved.field]: saved.message });
    else setNotice({ tone: "error", text: saved.message });
  }

  if (!services) return <p className="text-sm text-muted-foreground">Loading services…</p>;
  if (services.length === 0) {
    return <p className="text-sm text-muted-foreground">This person does no live service yet.</p>;
  }

  const fieldError = (field: string) =>
    errors[field] ? (
      <p role="alert" className="mt-1 text-xs text-[var(--lost)]">
        {errors[field]}
      </p>
    ) : null;

  return (
    <form onSubmit={save} className="rounded-lg border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">Book by hand</h2>
      <p className="mt-1 text-xs text-muted-foreground">
        A phone estimate or a walk-in. Any time this person is free, inside their hours or not.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="text-muted-foreground">Service</span>
          <select
            value={serviceId}
            onChange={(event) => {
              setServiceId(event.target.value);
              edited();
            }}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          >
            {services.map((one) => (
              <option key={one.id} value={one.id}>
                {one.name} ({one.durationMinutes} min)
              </option>
            ))}
          </select>
          {fieldError("bookingLinkId")}
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-sm">
            <span className="text-muted-foreground">Day</span>
            <select
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                edited();
              }}
              className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
            >
              {dates.map((one) => (
                <option key={one} value={one}>
                  {calendarDayWords(one)}
                </option>
              ))}
            </select>
            {fieldError("date")}
          </label>
          <label className="text-sm">
            <span className="text-muted-foreground">Time</span>
            <Input
              type="time"
              value={time}
              onChange={(event) => {
                setTime(event.target.value);
                edited();
              }}
              aria-invalid={errors.startMinute ? true : undefined}
              className="mt-1"
            />
            {fieldError("startMinute")}
          </label>
        </div>
        <label className="text-sm">
          <span className="text-muted-foreground">Customer&apos;s name</span>
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              edited();
            }}
            aria-invalid={errors["customer.name"] ? true : undefined}
            className="mt-1"
          />
          {fieldError("customer.name")}
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">Phone (optional)</span>
          <Input
            type="tel"
            value={phone}
            onChange={(event) => {
              setPhone(event.target.value);
              edited();
            }}
            aria-invalid={errors["customer.phone"] ? true : undefined}
            className="mt-1"
          />
          {fieldError("customer.phone")}
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">Email (optional)</span>
          <Input
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              edited();
            }}
            aria-invalid={errors["customer.email"] ? true : undefined}
            className="mt-1"
          />
          {fieldError("customer.email")}
        </label>
        {service && service.addressMode !== "not_asked" ? (
          <label className="text-sm">
            <span className="text-muted-foreground">Address (optional)</span>
            <Input
              value={address}
              onChange={(event) => {
                setAddress(event.target.value);
                edited();
              }}
              aria-invalid={errors.location ? true : undefined}
              className="mt-1"
            />
            {fieldError("location")}
          </label>
        ) : null}
        <label className="text-sm sm:col-span-2">
          <span className="text-muted-foreground">Note (optional)</span>
          <Input
            value={note}
            onChange={(event) => {
              setNote(event.target.value);
              edited();
            }}
            aria-invalid={errors.details ? true : undefined}
            className="mt-1"
          />
          {fieldError("details")}
        </label>
      </div>
      <div className="mt-4">
        <Button type="submit" disabled={saving || !serviceId}>
          {saving ? "Booking…" : "Book"}
        </Button>
      </div>
      <SaveNotice notice={notice} />
    </form>
  );
}
