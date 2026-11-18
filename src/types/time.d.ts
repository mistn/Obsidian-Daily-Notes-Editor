export type TimeRange =
    | "week"
    | "month"
    | "year"
    | "all"
    | "last-week"
    | "last-month"
    | "last-year"
    | "quarter"
    | "last-quarter"
    | "past-7-days"
    | "past-30-days"
    | "custom";

export type SelectionMode = "daily" | "folder" | "tag";

export type TimeField =
    | "ctime"
    | "mtime"
    | "ctimeReverse"
    | "mtimeReverse"
    | "name"
    | "nameReverse";
