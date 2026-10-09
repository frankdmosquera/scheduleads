// Booking component: one service's screen two, the customer's details, in the layout the service is
// set to (decision 4), like screen one.

import type { MonthDetailsScreenPropsType } from "./month-layout/month-details-screen.js";
import { MonthDetailsScreen } from "./month-layout/month-details-screen.js";

export type DetailsScreenPropsType = MonthDetailsScreenPropsType;

export function DetailsScreen(props: DetailsScreenPropsType) {
  switch (props.service.layout) {
    case "month":
      return <MonthDetailsScreen {...props} />;
    default: {
      const unhandledLayout: never = props.service.layout;
      void unhandledLayout;
      return <MonthDetailsScreen {...props} />;
    }
  }
}
