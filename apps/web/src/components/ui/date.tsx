import { DateTimePicker, type DateTimePickerProps } from "./date-time-picker";

export type DateFieldProps = Omit<DateTimePickerProps, "showTime"> & {
  showTime?: false;
};

export function DateField(props: DateFieldProps) {
  return <DateTimePicker showTime={false} {...props} />;
}
