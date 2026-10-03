// The one shape every refusal in the API takes. The frontend branches on `code`.

export type RefusalCodeType =
  | "unauthenticated" // no session at all
  | "no_active_organization" // signed in, but no single business to act for
  | "forbidden" // their role does not grant this permission
  | "plan_unrecognised" // the tier is not in the config: a misconfiguration
  | "plan_required" // a real tier that does not include this module
  | "not_found" // nothing there; public routes give one answer for every "not here", so none can be told apart
  | "bad_request" // a malformed value in the request, such as a slug or an id
  | "no_person" // signed in, but no person in this business is linked to the login
  | "email_taken" // setting up a client: that email's login already has a business
  | "slug_taken" // setting up a client: another business already has that address
  | "setup_in_progress" // setting up a client: another setup for that email or address is running
  | "unavailable" // the answer depends on something that cannot be read right now; try again shortly
  | "time_taken" // booking: the time stopped being free while the customer was booking
  | "request_key_used" // booking: this form's key already made a different booking
  | "key_refused"; // email: a business's own Resend key failed its test email; nothing was kept

export type RefusalType = {
  error: {
    code: RefusalCodeType;
    message: string;
  };
};

export const refuse = (code: RefusalCodeType, message: string): RefusalType => ({
  error: { code, message },
});
