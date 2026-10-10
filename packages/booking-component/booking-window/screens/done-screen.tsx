// Booking component: the screen after Book, in the layout the service is set to (decision 4), like
// screens one and two.

import type { MonthDoneScreenPropsType } from "./month-layout/month-done-screen.js";
import { MonthDoneScreen } from "./month-layout/month-done-screen.js";

export type DoneScreenPropsType = MonthDoneScreenPropsType;

export function DoneScreen(props: DoneScreenPropsType) {
  switch (props.service.layout) {
    case "month":
      return <MonthDoneScreen {...props} />;
    default: {
      const unhandledLayout: never = props.service.layout;
      void unhandledLayout;
      return <MonthDoneScreen {...props} />;
    }
  }
}
