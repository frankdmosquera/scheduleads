// Backend: runs the copies of one booking form one after the other, so a copy sent again while the
// first is still being saved waits for it and is then answered that booking (feature 9, decisions
// 8 and 9). Kept in the API's memory, like the rate limits: one API copy only (decision 7).

const formsInHand = new Map<string, Promise<unknown>>();

export const oneCopyOfAFormAtATime = {
  async book<ResultType>(
    formKey: string | null,
    book: () => Promise<ResultType>
  ): Promise<ResultType> {
    if (!formKey) return book(); // the owner's bookings carry no form key

    const before = formsInHand.get(formKey) ?? Promise.resolve();
    const turn = before.catch(() => {}).then(book); // the copy before may fail; this one still runs
    formsInHand.set(formKey, turn);
    try {
      return await turn;
    } finally {
      if (formsInHand.get(formKey) === turn) formsInHand.delete(formKey); // the last copy clears it
    }
  },

  // How many forms are being booked right now, so a test can see each one cleared.
  formsInHand(): number {
    return formsInHand.size;
  },
};
