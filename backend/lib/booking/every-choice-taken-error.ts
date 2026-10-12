// Backend: thrown inside a transaction when every person and room checked free was taken meanwhile,
// so all of the transaction is undone and the caller answers "taken".

export class EveryChoiceTakenError extends Error {
  constructor(message = "Every choice was taken meanwhile.") {
    super(message);
    this.name = "EveryChoiceTakenError";
  }
}
