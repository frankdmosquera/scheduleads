// Booking component, for a site's server code: its business's Look colours on its whole website
// (feature 25f). Its own entry, never "use client", so a server layout can call it.
//
// In a Next site's root layout (a server component), read them once a minute, pages stay static:
//
//   import { fetchSiteColours, siteColourTokens } from "@frankdmosquera/booking-component/site-colours";
//
//   const tokens = siteColourTokens(
//     await fetchSiteColours(apiUrl, slug, { next: { revalidate: 60 } })
//   );
//   <html style={tokens as CSSProperties} data-site-colours="main bg text">  (only those saved)
//
// Then the site's stylesheet works its own colours out of them, one rule per saved colour:
// :root[data-site-colours~="main"] from --site-main (buttons, accents), --site-main-ink (text on
// it) and --site-main-text (the main colour as readable text); ~="bg" from --site-bg; ~="text"
// from --site-text. Face and Body's app/globals.css is the worked example. With none saved, or
// the API unreachable, nothing is set and the site keeps its own colours.

export { fetchSiteColours } from "./api-client/fetch-site-colours.js";
export {
  siteColourTokens,
  type SiteColourTokensType,
  type SiteThemeType,
} from "./site-colours/site-colour-tokens.js";
