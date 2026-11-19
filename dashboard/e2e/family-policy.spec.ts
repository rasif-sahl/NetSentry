import { expect, test } from "@playwright/test";
import { readPolicyForm } from "../src/features/family/policy-input";

test("family policy form preserves schedules and category purposes", () => {
  const form = new FormData();
  form.set("enabled", "on");
  form.set("appLimits", "com.example.game:30");
  form.set("categoryLimits", "learning:45:education");
  form.set("allowedApps", "com.example.one, com.example.two");
  const schedules = [
    { kind: "bedtime" as const, days: [1], start: "21:00", end: "07:00" },
  ];

  expect(readPolicyForm(form, schedules)).toMatchObject({
    enabled: true,
    dailyMinutes: null,
    appLimits: [{ id: "com.example.game", minutes: 30 }],
    categoryLimits: [{ id: "learning", minutes: 45, purpose: "education" }],
    allowedApps: ["com.example.one", "com.example.two"],
    schedules,
  });
});

test("family policy form rejects a category purpose on an app limit", () => {
  const form = new FormData();
  form.set("appLimits", "com.example.game:30:education");
  expect(() => readPolicyForm(form, [])).toThrow("Use ID:minutes");
});
