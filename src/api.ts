// Share concurrent GET requests (including React development StrictMode mounts)
// without caching results or replaying mutation requests.
const inFlight = new Map<string, Promise<unknown>>();
export function api<T>(path: string, body?: unknown): Promise<T> {
  if (__GURU_STATIC__)
    return import("./static").then((module) =>
      module.staticApi(path, body),
    ) as Promise<T>;
  if (body === undefined && inFlight.has(path))
    return inFlight.get(path) as Promise<T>;
  const request = (async () => {
    const response = await fetch("/api" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? {} : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(150000),
    });
    const value = await response.json();
    if (!response.ok)
      throw new Error(
        value.error || `Anfrage fehlgeschlagen (${response.status})`,
      );
    return value as T;
  })();
  if (body === undefined) {
    inFlight.set(path, request);
    const clear = () => {
      if (inFlight.get(path) === request) inFlight.delete(path);
    };
    request.then(clear, clear);
  }
  return request;
}
export const money = (n: number | undefined, currency = "EUR") =>
  n === undefined
    ? "—"
    : new Intl.NumberFormat("de-DE", {
        style: "currency",
        currency,
        maximumFractionDigits: 2,
      }).format(n);
export const percent = (n: number | undefined) =>
  n === undefined
    ? "—"
    : `${n >= 0 ? "+" : ""}${n.toFixed(2).replace(".", ",")} %`;
export const date = (s: string | undefined) =>
  s
    ? new Date(s.length === 10 ? s + "T12:00:00Z" : s).toLocaleDateString(
        "de-DE",
        { day: "2-digit", month: "short", year: "numeric" },
      )
    : "—";
