import { Calendar as CalendarIcon, Clock } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

import { Button } from "./button";
import { Input } from "./input";

export interface DateTimePickerProps {
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showTime?: boolean;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "Select date and time",
  className,
  disabled = false,
  showTime = true,
}: DateTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");
  const [year, setYear] = React.useState(
    value?.getFullYear() ?? new Date().getFullYear()
  );
  const [month, setMonth] = React.useState(
    value?.getMonth() ?? new Date().getMonth()
  );
  const [hours, setHours] = React.useState(value?.getHours() ?? 12);
  const [minutes, setMinutes] = React.useState(value?.getMinutes() ?? 0);

  React.useEffect(() => {
    if (value) {
      setInputValue(formatDateTime(value));
      setYear(value.getFullYear());
      setMonth(value.getMonth());
      setHours(value.getHours());
      setMinutes(value.getMinutes());
    }
  }, [value]);

  const formatDate = (date: Date): string =>
    date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const formatDateTime = (date: Date): string => {
    const dateStr = formatDate(date);
    const timeStr = date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return showTime ? `${dateStr} at ${timeStr}` : dateStr;
  };

  const getDaysInMonth = (yr: number, mo: number): number =>
    new Date(yr, mo + 1, 0).getDate();

  const getFirstDayOfMonth = (yr: number, mo: number): number =>
    new Date(yr, mo, 1).getDay();

  const isSameDay = (d1: Date, d2: Date): boolean =>
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();

  const handleDayClick = (day: number) => {
    const newDate = new Date(year, month, day, hours, minutes);
    onChange?.(newDate);
    setInputValue(formatDateTime(newDate));
    setIsOpen(false);
  };

  const handleTimeChange = () => {
    if (value) {
      const newDate = new Date(value);
      newDate.setHours(hours, minutes);
      onChange?.(newDate);
      setInputValue(formatDateTime(newDate));
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      handleTimeChange();
    }
  }, [hours, minutes]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const days: React.ReactNode[] = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(<div className="p-2" key={`empty-${i}`} />);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const currentDate = new Date(year, month, day);
    const isSelected = value && isSameDay(currentDate, value);

    days.push(
      <button
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors",
          "hover:bg-void-surface/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-biolum",
          isSelected && "bg-biolum text-background hover:bg-biolum",
          disabled && "cursor-not-allowed opacity-50"
        )}
        disabled={disabled}
        key={day}
        onClick={() => handleDayClick(day)}
        type="button"
      >
        {day}
      </button>
    );
  }

  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  return (
    <div className={cn("relative", className)}>
      <Button
        className={cn(
          "w-full justify-start text-left font-normal",
          !value && "text-biolum-dim"
        )}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        type="button"
        variant="outline"
      >
        <CalendarIcon className="mr-2 h-4 w-4" />
        {value ? inputValue : placeholder}
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 w-72 rounded-xl border border-white/10 bg-void-surface p-4 shadow-lg">
          <div className="mb-4 flex items-center justify-between">
            <Button
              onClick={() => setMonth((prev) => (prev === 0 ? 11 : prev - 1))}
              size="sm"
              type="button"
              variant="ghost"
            >
              ←
            </Button>
            <span className="font-medium text-biolum">
              {monthNames[month]} {year}
            </span>
            <Button
              onClick={() => setMonth((prev) => (prev === 11 ? 0 : prev + 1))}
              size="sm"
              type="button"
              variant="ghost"
            >
              →
            </Button>
          </div>

          <div className="mb-2 grid grid-cols-7 gap-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <div
                className="p-2 text-center font-medium text-biolum-dim text-xs"
                key={day}
              >
                {day}
              </div>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-7 gap-1">{days}</div>

          {showTime && (
            <div className="flex items-center gap-4 border-white/10 border-t pt-4">
              <Clock className="h-4 w-4 text-biolum-dim" />
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 w-16 text-center"
                  disabled={disabled}
                  max="23"
                  min="0"
                  onChange={(e) =>
                    setHours(
                      Math.min(
                        23,
                        Math.max(0, Number.parseInt(e.target.value, 10))
                      )
                    )
                  }
                  type="number"
                  value={hours.toString().padStart(2, "0")}
                />
                <span className="text-biolum-dim">:</span>
                <Input
                  className="h-8 w-16 text-center"
                  disabled={disabled}
                  max="59"
                  min="0"
                  onChange={(e) =>
                    setMinutes(
                      Math.min(
                        59,
                        Math.max(0, Number.parseInt(e.target.value, 10))
                      )
                    )
                  }
                  type="number"
                  value={minutes.toString().padStart(2, "0")}
                />
              </div>
              <span className="ml-auto text-biolum-dim text-xs">
                {hours % 12 || 12}:{minutes.toString().padStart(2, "0")}{" "}
                {hours >= 12 ? "PM" : "AM"}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
