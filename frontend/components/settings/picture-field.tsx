// Frontend component: one picture of the business (feature 25e), the logo or a service's photo:
// what is there now, Upload or Replace, and Remove. The picture is made light in the browser, then
// saved at once; a login that may not change the business only sees it.

"use client";

import { useId, useRef, useState } from "react";

import { SaveNotice, type SaveNoticeType } from "@/components/settings/save-notice";
import { Button } from "@/components/ui/button";
import { savePicture, type PictureTargetType } from "@/lib/api-client/settings/save-picture";
import { useDashboardWords } from "@/lib/dashboard-words/dashboard-words-provider";
import { shrinkPicture } from "@/lib/shrink-picture";

export function PictureField({
  target,
  label,
  hint,
  emptyLine,
  alt,
  picture,
  longestSide,
  canEdit,
  onSaved,
}: {
  target: PictureTargetType;
  label: string;
  hint: string;
  emptyLine: string; // what shows while there is none
  alt: string;
  picture: string | null;
  longestSide: number; // how large it is kept: a logo 600, a photo 1200
  canEdit: boolean;
  onSaved: (picture: string | null) => void;
}) {
  const { lookWords } = useDashboardWords().words;
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<SaveNoticeType>(null);

  const save = async (file: File | null) => {
    setNotice(null);
    setBusy(true);
    const light = file ? await shrinkPicture(file, longestSide) : null;
    if (file && !light) {
      setBusy(false);
      setNotice({ tone: "error", text: lookWords.notAPicture });
      return;
    }
    const saved = await savePicture(target, light);
    setBusy(false);
    if (saved.state !== "ok") {
      setNotice({ tone: "error", text: saved.message });
      return;
    }
    onSaved(saved.answer);
    setNotice({ tone: "info", text: saved.answer ? lookWords.saved : lookWords.removed });
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className="text-sm font-medium">
        {label}
      </span>
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex size-24 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {picture ? (
            // eslint-disable-next-line @next/next/no-img-element -- an ImageKit address, sized by ImageKit
            <img
              src={`${picture}?tr=w-192`}
              alt={alt}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="px-2 text-center text-xs text-muted-foreground">{emptyLine}</span>
          )}
        </div>
        {canEdit ? (
          <div className="flex flex-wrap gap-2">
            <input
              ref={input}
              id={id}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              aria-labelledby={`${id}-label`}
              aria-describedby={`${id}-hint`}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                event.target.value = ""; // the same file can be chosen again
                if (file) void save(file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => input.current?.click()}
            >
              {busy ? lookWords.uploading : picture ? lookWords.replace : lookWords.upload}
            </Button>
            {picture ? (
              <Button type="button" variant="ghost" disabled={busy} onClick={() => void save(null)}>
                {lookWords.remove}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {hint} {canEdit ? lookWords.pictureTypes : ""}
      </p>
      <SaveNotice notice={notice} />
    </div>
  );
}
