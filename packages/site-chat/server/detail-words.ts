/**
 * Whether a message names something the brief has its own details for (a service, a group of them) that no answer
 * Jev picked names too: "How much is the hydra spa facial?" is then the AI's, which has its price and length, not
 * a stored answer that only sounds close ("Why do some treatments not show a price?").
 */
export function namesOtherDetail(
  message: string,
  picked: readonly string[],
  detailWords: readonly string[]
): boolean {
  const plain = (text: string) =>
    ` ${text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()} `;
  const said = plain(message);
  const answers = picked.map(plain);
  return detailWords.some((word) => {
    const w = plain(word);
    return w.trim() !== "" && said.includes(w) && !answers.some((a) => a.includes(w));
  });
}
