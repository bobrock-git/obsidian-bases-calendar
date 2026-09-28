import { getLanguage } from "obsidian";

const translations = {
  en: {
    calendar: "Calendar", empty: "Configure a start date property to display entries",
    zoomIn: "Zoom in", zoomOut: "Zoom out", workWeek: "Work week", threeDay: "3 day", dayView: "Day", today: "Today",
    move: "Move events", stopMove: "Stop moving",
    reschedule: "Reschedule", openNote: "Open note", openTab: "Open in new tab", deleteFile: "Delete file",
    dateProperties: "Date properties", startDate: "Start date", endDate: "End date (optional)",
    dateSources: "Multiple date sources", dateSourcesHint: "Advanced: roles from one note (JSON or YAML list)",
    filterEvents: "Filter calendar entries",
    duration: "Duration in minutes (optional)", property: "Property", eventDisplay: "Event display",
    detailProperty: "Detail property", detailHint: "Property shown on 2nd line (e.g. people)",
    colorProperty: "Color property", colorHint: "Property (e.g. tomato, sage, peacock…)",
    calendarOptions: "Calendar options", weekStarts: "Week starts on", dayStarts: "Day starts at",
    sunday: "Sunday", monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday",
    thursday: "Thursday", friday: "Friday", saturday: "Saturday", midnight: "Midnight",
    date: "Date", newDate: "New date", quickDates: "Quick date selection", tomorrow: "Tomorrow",
    dayAfterTomorrow: "Day after tomorrow", nextWeek: "In a week", allDay: "All day",
    time: "Time", newTime: "New time", cancel: "Cancel", save: "Save",
    invalidDate: "Choose a valid date and time", saved: "Event rescheduled",
    saveFailed: "Could not reschedule event", weekend: "event falls on a weekend",
    saturdayShort: "Sat", sundayShort: "Sun",
  },
  pl: {
    calendar: "Kalendarz", empty: "Skonfiguruj właściwość daty początkowej, aby wyświetlić wpisy",
    zoomIn: "Powiększ", zoomOut: "Pomniejsz", workWeek: "Tydzień roboczy", threeDay: "3 dni", dayView: "Dzień", today: "Dziś",
    move: "Przesuwaj terminy", stopMove: "Zakończ przesuwanie",
    reschedule: "Zmień termin", openNote: "Otwórz notatkę", openTab: "Otwórz w nowej karcie", deleteFile: "Usuń plik",
    dateProperties: "Właściwości daty", startDate: "Data początkowa", endDate: "Data końcowa (opcjonalnie)",
    dateSources: "Wiele źródeł daty", dateSourcesHint: "Zaawansowane: role z jednej notatki (lista JSON lub YAML)",
    filterEvents: "Filtruj wpisy kalendarza",
    duration: "Czas trwania w minutach (opcjonalnie)", property: "Właściwość", eventDisplay: "Wyświetlanie wydarzeń",
    detailProperty: "Dodatkowa właściwość", detailHint: "Właściwość w drugim wierszu (np. osoby)",
    colorProperty: "Właściwość koloru", colorHint: "Właściwość (np. tomato, sage, peacock…)",
    calendarOptions: "Opcje kalendarza", weekStarts: "Początek tygodnia", dayStarts: "Początek dnia",
    sunday: "Niedziela", monday: "Poniedziałek", tuesday: "Wtorek", wednesday: "Środa",
    thursday: "Czwartek", friday: "Piątek", saturday: "Sobota", midnight: "Północ",
    date: "Data", newDate: "Nowa data", quickDates: "Szybki wybór daty", tomorrow: "Jutro",
    dayAfterTomorrow: "Pojutrze", nextWeek: "Za tydzień", allDay: "Cały dzień",
    time: "Godzina", newTime: "Nowa godzina", cancel: "Anuluj", save: "Zapisz",
    invalidDate: "Wybierz poprawną datę i godzinę", saved: "Termin zmieniony",
    saveFailed: "Nie udało się zmienić terminu", weekend: "termin wypada w weekend",
    saturdayShort: "sob.", sundayShort: "niedz.",
  },
} as const;

type TranslationKey = keyof typeof translations.en;
export const language = (): "pl" | "en" => getLanguage().toLowerCase().startsWith("pl") ? "pl" : "en";
export const t = (key: TranslationKey): string => translations[language()][key];
export const locale = (): string => language() === "pl" ? "pl-PL" : "en-US";
export const translationKeysComplete = (): boolean =>
  Object.keys(translations.en).sort().join("|") === Object.keys(translations.pl).sort().join("|");
