import { NewScheduleForm } from "./NewScheduleForm";
import { addMonths, thisMonthJST, todayJST } from "@/lib/time";

export default function NewSchedulePage() {
  return (
    <NewScheduleForm
      initialMonth={addMonths(thisMonthJST(), 1)}
      today={todayJST()}
    />
  );
}
