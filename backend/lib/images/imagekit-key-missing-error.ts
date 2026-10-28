// Backend: thrown when the ImageKit key is not set, so the route answers "pictures cannot be saved
// right now" instead of a fault (feature 25e).

export class ImageKitKeyMissingError extends Error {}
