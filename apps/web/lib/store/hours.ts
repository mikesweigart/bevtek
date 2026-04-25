/**
 * Store hours helpers.
 *
 * hours_json is a jsonb column on public.stores. Shape per-day:
 *   { "mon": { "closed": false, "open": "09:00", "close": "22:00" }, ... }
 *
 * A day may be missing entirely (treat as "not set"), or may be recorded as
 *   { "closed": true }                       → explicitly closed
 *   { "closed": false, "open, close }        → open window
 *
 * We canonicalize via parseHours / serializeHours so the UI, the server
 * action, and Gabby's voice script all agree on the representation. Times
 * are stored as "HH:MM" 24-hour strings — we resist the urge to store
 * minutes-since-midnight integers because everyone debugging this from
 * the SQL editor wants to read "09:00" not "540".
 */
export const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABEL: Record<Day, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export type DayHours =
  | { closed: true }
  | { closed: false; open: string; close: string };

export type HoursJson = Partial<Record<Day, DayHours>>;

const TIME_RX = /^([01]\d|2[0-3]):[0-5]\d$/;

function isDayHours(v: unknown): v is DayHours {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  if (o.closed === true) return true;
  return (
    o.closed === false &&
    typeof o.open === "string" &&
    TIME_RX.test(o.open) &&
    typeof o.close === "string" &&
    TIME_RX.test(o.close)
  );
}

/**
 * Accept arbitrary jsonb (from Supabase) and return a typed HoursJson,
 * dropping any garbage. Never throws — an unparseable row just yields {}
 * which renders as "hours not set" in the UI.
 */
export function parseHours(raw: unknown): HoursJson {
  if (!raw || typeof raw !== "object") return {};
  const out: HoursJson = {};
  for (const d of DAYS) {
    const v = (raw as Record<string, unknown>)[d];
    if (isDayHours(v)) out[d] = v;
  }
  return out;
}

/**
 * Build HoursJson from flat form fields:
 *   hours_<day>_closed : "on" | undefined
 *   hours_<day>_open   : "HH:MM"
 *   hours_<day>_close  : "HH:MM"
 *
 * Invalid/missing times yield an omitted day (not a closed day) so the
 * user can leave rows blank without committing them. Only when the user
 * explicitly ticks "Closed" do we persist closed:true.
 */
export function hoursFromFormData(formData: FormData): HoursJson {
  const out: HoursJson = {};
  for (const d of DAYS) {
    const closed = formData.get(`hours_${d}_closed`) === "on";
    if (closed) {
      out[d] = { closed: true };
      continue;
    }
    const open = String(formData.get(`hours_${d}_open`) ?? "").trim();
    const close = String(formData.get(`hours_${d}_close`) ?? "").trim();
    if (TIME_RX.test(open) && TIME_RX.test(close)) {
      out[d] = { closed: false, open, close };
    }
    // else: leave day unset
  }
  return out;
}

/**
 * Sensible defaults for an empty store: Mon–Sat 10:00–22:00, Sun 12:00–20:00.
 * Used to pre-fill the form on first visit so the owner doesn't stare at a
 * blank grid. We intentionally don't WRITE these defaults until they click
 * Save — the stored '{}' is the signal "this store hasn't set hours yet".
 */
export function defaultHours(): HoursJson {
  return {
    mon: { closed: false, open: "10:00", close: "22:00" },
    tue: { closed: false, open: "10:00", close: "22:00" },
    wed: { closed: false, open: "10:00", close: "22:00" },
    thu: { closed: false, open: "10:00", close: "22:00" },
    fri: { closed: false, open: "10:00", close: "23:00" },
    sat: { closed: false, open: "10:00", close: "23:00" },
    sun: { closed: false, open: "12:00", close: "20:00" },
  };
}
