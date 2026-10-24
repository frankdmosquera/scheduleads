// Booking component: "Who would you like?" in the rail, for a service the customer picks the person
// for (decision 3). "Any available" first; then the people by name, as the API lists them.

import { useId } from "react";

import { useBookingWords } from "../../../words/booking-words-context.js";

export type PersonChoicePropsType = {
  people: { id: string; name: string }[];
  personId: string | null; // null = any available
  onChange(personId: string | null): void;
};

export function PersonChoice({ people, personId, onChange }: PersonChoicePropsType) {
  const groupName = useId();
  const words = useBookingWords();
  const options = [{ id: null, name: words.anyAvailable }, ...people];

  return (
    <fieldset className="sa-people">
      <legend className="sa-people-h">{words.whoWouldYouLike}</legend>
      {options.map((option) => (
        <label key={option.id ?? "any"} className="sa-person">
          <input
            type="radio"
            name={groupName}
            checked={personId === option.id}
            onChange={() => onChange(option.id)}
          />
          <span>{option.name}</span>
        </label>
      ))}
    </fieldset>
  );
}
