import { useMemo } from "react";
interface DashboardCalendarRibbonProps {
  locale: string;
}

interface CalendarDay {
  key: string;
  isToday: boolean;
  weekdayLabel: string;
  dayNumber: number;
  title: string;
}

export function DashboardCalendarRibbon({ locale }: DashboardCalendarRibbonProps) {
  const days = useMemo<CalendarDay[]>(() => {
    const today = new Date();
    const normalizedLocale = locale.trim().toLowerCase();
    const uiLocale = normalizedLocale.startsWith("ru") ? "ru-RU" : "en-US";
    const weekdayFormatter = new Intl.DateTimeFormat(uiLocale, { weekday: "short" });
    const titleFormatter = new Intl.DateTimeFormat(uiLocale, {
      day: "2-digit",
      month: "long",
      year: "numeric"
    });
    const result: CalendarDay[] = [];

    for (let shift = -7; shift <= 7; shift += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + shift);
      const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;

      result.push({
        key: dateKey,
        isToday: shift === 0,
        weekdayLabel: weekdayFormatter.format(date),
        dayNumber: date.getDate(),
        title: titleFormatter.format(date)
      });
    }

    return result;
  }, [locale]);

  return (
    <section className="dashboard-calendar-ribbon" aria-label="Лента календаря">
      <div className="dashboard-calendar-ribbon-scroll" role="list">
        {days.map((day) => (
          <div
            key={day.key}
            role="listitem"
            className={day.isToday ? "dashboard-calendar-day dashboard-calendar-day-current" : "dashboard-calendar-day"}
            title={day.title}
            aria-current={day.isToday ? "date" : undefined}
          >
            <span className="dashboard-calendar-day-weekday">{day.weekdayLabel}</span>
            <span className="dashboard-calendar-day-number">{day.dayNumber}</span>
          </div>
        ))}
      </div>
    </section>
  );
}