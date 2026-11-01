// Options screen (title menu and in-game Esc menu).
import { settings, saveSettings, DEFAULTS, Settings } from "./settings.ts";
import { lang, setLang } from "./i18n.ts";

const $ = (id: string) => document.getElementById(id)!;
const L = (pl: string, en: string) => (lang === "pl" ? pl : en);

type Row = { key: keyof Settings | "lang"; label: string; hint?: string; kind: "range" | "select" | "check"; min?: number; max?: number; step?: number; opts?: [string | number, string][] };

export function openOptions(onChange: () => void, onClose: () => void) {
  const rows: Row[] = [
    { key: "lang", label: L("Język", "Language"), kind: "select", opts: [["pl", "Polski"], ["en", "English"]] },
    { key: "battleSize", label: L("Liczebność bitwy", "Battle size"), hint: L("ilu walczy naraz po każdej stronie; reszta przychodzi jako posiłki", "fighters per side on the field at once"), kind: "range", min: 8, max: 40, step: 2 },
    { key: "quality", label: L("Jakość obrazu", "Image quality"), hint: L("rozdzielczość wewnętrzna; niższa = szybciej na słabych laptopach", "internal resolution; lower is faster"), kind: "select", opts: [[0, L("niska (240 linii)", "low (240 lines)")], [1, L("średnia (360 linii)", "medium (360 lines)")], [2, L("wysoka (480 linii)", "high (480 lines)")]] },
    { key: "gore", label: L("Przemoc", "Gore"), kind: "select", opts: [[1, L("pełna: odcinanie, krew", "full: severing, blood")], [0, L("mniej krwi, bez odcinania", "less blood, no severing")]] },
    { key: "difficulty", label: L("Obrażenia otrzymywane", "Damage taken"), kind: "select", opts: [[0, L("łagodne (60%)", "light (60%)")], [1, L("normalne", "normal")], [2, L("brutalne (130%)", "brutal (130%)")]] },
    { key: "autoBlock", label: L("Automatyczny kierunek bloku", "Automatic block direction"), kind: "check" },
    { key: "hints", label: L("Podpowiedź nadchodzącego ciosu", "Incoming blow hint"), kind: "check" },
    { key: "sens", label: L("Czułość myszy", "Mouse sensitivity"), kind: "range", min: 0.3, max: 2.5, step: 0.1 },
    { key: "invertY", label: L("Odwróć oś Y myszy", "Invert mouse Y"), kind: "check" },
    { key: "volume", label: L("Głośność", "Volume"), kind: "range", min: 0, max: 1, step: 0.05 },
  ];
  const box = $("opts"); box.hidden = false;
  const body = rows.map((r) => {
    const v = r.key === "lang" ? lang : settings[r.key as keyof Settings];
    let ctl = "";
    if (r.kind === "range") ctl = `<input type="range" id="o-${r.key}" min="${r.min}" max="${r.max}" step="${r.step}" value="${v}"><output id="ov-${r.key}">${fmt(r.key, Number(v))}</output>`;
    else if (r.kind === "check") ctl = `<input type="checkbox" id="o-${r.key}" ${v ? "checked" : ""}>`;
    else ctl = `<select id="o-${r.key}">${r.opts!.map(([k, n]) => `<option value="${k}" ${String(k) === String(v) ? "selected" : ""}>${n}</option>`).join("")}</select>`;
    return `<label class="orow" for="o-${r.key}"><span>${r.label}${r.hint ? `<small>${r.hint}</small>` : ""}</span><span class="octl">${ctl}</span></label>`;
  }).join("");
  box.innerHTML = `<div class="panel"><h2>${L("Opcje", "Options")}</h2><div class="olist">${body}</div><div class="obtns"><button type="button" class="ib" id="o-reset">${L("Domyślne", "Defaults")}</button><button type="button" class="ib on" id="o-close">${L("Zamknij", "Close")}</button></div></div>`;
  for (const r of rows) {
    const el = document.getElementById("o-" + r.key) as HTMLInputElement | HTMLSelectElement;
    el.addEventListener("input", () => {
      if (r.key === "lang") { setLang((el as HTMLSelectElement).value as "pl" | "en"); onChange(); openOptions(onChange, onClose); return; }
      const s = settings as unknown as Record<string, unknown>;
      if (r.kind === "check") s[r.key] = (el as HTMLInputElement).checked;
      else if (r.kind === "range") { s[r.key] = Number(el.value); const o = document.getElementById("ov-" + r.key); if (o) o.textContent = fmt(r.key, Number(el.value)); }
      else s[r.key] = Number(el.value);
      saveSettings(); onChange();
    });
  }
  $("o-reset").addEventListener("click", () => { Object.assign(settings, DEFAULTS); saveSettings(); onChange(); openOptions(onChange, onClose); });
  $("o-close").addEventListener("click", () => { box.hidden = true; onClose(); });
}
function fmt(k: string, v: number) {
  if (k === "volume") return Math.round(v * 100) + "%";
  if (k === "sens") return v.toFixed(1) + "×";
  return String(v);
}
export function closeOptions() { $("opts").hidden = true; }
