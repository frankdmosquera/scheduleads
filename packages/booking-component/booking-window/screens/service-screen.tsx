// Booking component: one service's screen one, pick a time, in the layout the service is set to
// (decision 4). Each layout is one more branch here.

import type { MonthServiceScreenPropsType } from "./month-layout/month-service-screen.js";
import { MonthServiceScreen } from "./month-layout/month-service-screen.js";

export type ServiceScreenPropsType = MonthServiceScreenPropsType;

export function ServiceScreen(props: ServiceScreenPropsType) {
  switch (props.service.layout) {
    case "month":
      return <MonthServiceScreen {...props} />;
    default: {
      // A layout added to the API stops this build until it gets its branch. A component built
      // before it, meeting it live, shows the month.
      const unhandledLayout: never = props.service.layout;
      void unhandledLayout;
      return <MonthServiceScreen {...props} />;
    }
  }
}
