// The one shape every refusal in the API takes. The frontend branches on `code`.

export type RefusalCodeType =
  | "unauthenticated" // no session at all
  | "no_active_organization" // signed in, but no single business to act for
  | "forbidden" // their role does not grant this permission
  | "plan_unrecognised" // the tier is not in the config: a misconfiguration
  | "plan_required" // a real tier that does not include this module
  | "not_found" // nothing there; public routes give one answer for every "not here", so none can be told apart
  | "bad_request" // a malformed value in the request, such as a slug or an id
  | "no_person"; // signed in, but no person in this business is linked to the login

export type RefusalType = {
  error: {
    code: RefusalCodeType;
    message: string;
  };
};

export const refuse = (code: RefusalCodeType, message: string): RefusalType => ({
  error: { code, message },
});
