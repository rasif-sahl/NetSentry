"use client";
import { useState } from "react";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import { ActionForm, Field } from "@/shared/ui/common";
import { FamilyConsent } from "./family-consent";
import { readPolicyForm } from "./policy-input";
import type { Rules } from "./types";

const emptyRules = (): Rules => ({
  enabled: true,
  dailyMinutes: null,
  appLimits: [],
  categoryLimits: [],
  allowedApps: [],
  restrictedApps: [],
  schedules: [],
  pauseUntil: null,
  networkPause: false,
  domains: [],
  domainCategories: [],
});

export function PolicyForm({
  initial,
  ageBand,
  save,
}: {
  initial?: Rules;
  ageBand: string;
  save: (rules: Rules) => Promise<void>;
}) {
  const [schedules, setSchedules] = useState(initial?.schedules ?? []);
  const [openedAt] = useState(() => Date.now());
  const r = initial ?? emptyRules();
  const Form = initial ? ActionForm : ActionFormDialog;
  const dialog = initial
    ? {}
    : {
        label: "Create family policy",
        primary: true,
        onClose: () => setSchedules([]),
      };
  return (
    <Form
      {...dialog}
      submit="Save requested policy"
      action={async (f) => {
        await save(readPolicyForm(f, schedules));
        return "Policy saved as requested. No restriction is claimed applied.";
      }}
    >
      <p>
        Suggested starting point for {ageBand.replaceAll("_", " ")}:{" "}
        {ageBand === "under_13"
          ? "60"
          : ageBand === "teen"
            ? "120"
            : "no automatic"}{" "}
        daily minutes. Choose limits with the child; age bands do not
        automatically enable restrictions.
      </p>
      <label className="check">
        <input name="enabled" type="checkbox" defaultChecked={r.enabled} />
        Evaluate this policy
      </label>
      <Field label="Daily observed screen-time allowance (minutes)">
        <input
          type="number"
          name="dailyMinutes"
          min={1}
          max={1440}
          defaultValue={r.dailyMinutes ?? ""}
        />
      </Field>
      <Field
        label="App limits"
        hint="One Android application ID:minutes per line, for example com.example.game:30."
      >
        <textarea
          name="appLimits"
          defaultValue={r.appLimits
            .map((x) => `${x.id}:${x.minutes}`)
            .join("\n")}
        />
      </Field>
      <Field
        label="Category limits"
        hint="One category ID:minutes[:purpose] per line. Optional purpose: education, entertainment or other. Custom category UUIDs are supported; purpose explicitly labels the comparison."
      >
        <textarea
          name="categoryLimits"
          defaultValue={r.categoryLimits
            .map(
              (x) => `${x.id}:${x.minutes}${x.purpose ? ":" + x.purpose : ""}`,
            )
            .join("\n")}
        />
      </Field>
      {(
        [
          "allowedApps",
          "restrictedApps",
          "domains",
          "domainCategories",
        ] as const
      ).map((name) => (
        <Field
          key={name}
          label={
            {
              allowedApps: "Allowed application IDs",
              restrictedApps: "Restricted application IDs",
              domains: "Requested blocked domains",
              domainCategories: "Requested blocked domain categories",
            }[name]
          }
          hint="Separate entries with spaces or commas. These selections are unsupported enforcement intents."
        >
          <textarea name={name} defaultValue={r[name].join(", ")} />
        </Field>
      ))}
      <fieldset>
        <legend>Bedtime, study and weekend schedules</legend>
        {schedules.map((s, index) => (
          <fieldset key={index}>
            <legend>Schedule {index + 1}</legend>
            <Field label={`Schedule ${index + 1} type`}>
              <select
                value={s.kind}
                onChange={(e) =>
                  setSchedules((a) =>
                    a.map((x, i) =>
                      i === index
                        ? { ...x, kind: e.target.value as typeof s.kind }
                        : x,
                    ),
                  )
                }
              >
                {["bedtime", "study", "weekend"].map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </Field>
            {(["start", "end"] as const).map((k) => (
              <Field key={k} label={`Schedule ${index + 1} ${k}`}>
                <input
                  type="time"
                  required
                  value={s[k]}
                  onChange={(e) =>
                    setSchedules((a) =>
                      a.map((x, i) =>
                        i === index ? { ...x, [k]: e.target.value } : x,
                      ),
                    )
                  }
                />
              </Field>
            ))}
            <div>
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                (day, n) => (
                  <label className="check" key={day}>
                    <input
                      type="checkbox"
                      checked={s.days.includes(n)}
                      onChange={(e) =>
                        setSchedules((a) =>
                          a.map((x, i) =>
                            i === index
                              ? {
                                  ...x,
                                  days: e.target.checked
                                    ? [...x.days, n]
                                    : x.days.filter((d) => d !== n),
                                }
                              : x,
                          ),
                        )
                      }
                    />
                    {day}
                  </label>
                ),
              )}
            </div>
            <button
              type="button"
              className="button"
              onClick={() =>
                setSchedules((a) => a.filter((_, i) => i !== index))
              }
            >
              Remove schedule {index + 1}
            </button>
          </fieldset>
        ))}
        <button
          type="button"
          className="button"
          disabled={schedules.length >= 12}
          onClick={() =>
            setSchedules((a) => [
              ...a,
              {
                kind: "bedtime",
                days: [1, 2, 3, 4, 5],
                start: "21:00",
                end: "07:00",
              },
            ])
          }
        >
          Add schedule
        </button>
        <p>
          Times use the policy timezone shown above. Overnight schedules
          continue into the following day; repeated DST hours follow the same
          local rule.
        </p>
      </fieldset>
      <Field
        label="Temporary device pause until"
        hint="Optional local date/time, at most 24 hours ahead; records an unsupported pause request."
      >
        <input
          type="datetime-local"
          name="pauseUntil"
          defaultValue={
            r.pauseUntil && Date.parse(r.pauseUntil) > openedAt
              ? new Date(
                  Date.parse(r.pauseUntil) -
                    new Date(r.pauseUntil).getTimezoneOffset() * 60000,
                )
                  .toISOString()
                  .slice(0, 16)
              : ""
          }
        />
      </Field>
      <label className="check">
        <input
          name="networkPause"
          type="checkbox"
          defaultChecked={r.networkPause}
        />
        Request network pause (unsupported by current router adapter)
      </label>
      <FamilyConsent />
    </Form>
  );
}
