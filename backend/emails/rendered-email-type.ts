// Backend: an email ready for sendEmail, its HTML and its plain-text twin.

export type RenderedEmailType = {
  subject: string;
  html: string;
  text: string;
};
