import { text } from "@/shared/form-values";
import type { Rules } from "./types";

function readLimits(form: FormData, field: "appLimits" | "categoryLimits") {
  return text(form, field)
    .split(/[\n,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [id, minutes, purpose, ...extra] = entry.split(":");
      if (
        extra.length ||
        (purpose &&
          (field !== "categoryLimits" ||
            !["education", "entertainment", "other"].includes(purpose)))
      ) {
        throw new Error(
          "Use ID:minutes and an optional education, entertainment or other category purpose.",
        );
      }
      return {
        id: id.trim(),
        minutes: Number(minutes),
        ...(purpose
          ? { purpose: purpose as "education" | "entertainment" | "other" }
          : {}),
      };
    });
}

export function readPolicyForm(
  form: FormData,
  schedules: Rules["schedules"],
): Rules {
  const list = (field: string) =>
    text(form, field)
      .split(/[\s,]+/)
      .filter(Boolean);
  const dailyMinutes = text(form, "dailyMinutes");
  const pauseUntil = text(form, "pauseUntil");
  return {
    enabled: form.has("enabled"),
    dailyMinutes: dailyMinutes ? Number(dailyMinutes) : null,
    appLimits: readLimits(form, "appLimits"),
    categoryLimits: readLimits(form, "categoryLimits"),
    allowedApps: list("allowedApps"),
    restrictedApps: list("restrictedApps"),
    schedules,
    pauseUntil: pauseUntil ? new Date(pauseUntil).toISOString() : null,
    networkPause: form.has("networkPause"),
    domains: list("domains"),
    domainCategories: list("domainCategories"),
  };
}
