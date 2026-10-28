// Booking component: a service's photo asked of ImageKit at the size it is shown (feature 25e),
// so the window never loads the full picture for a small card. An address that already carries a
// question gets the size added to it.

export function sizedPicture(address: string, transform: string): string {
  return `${address}${address.includes("?") ? "&" : "?"}tr=${transform}`;
}
