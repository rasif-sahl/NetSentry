import { Field } from "@/shared/ui/common";
import type { Department } from "./types";

export function DepartmentField({
  departments,
  value = "",
}: {
  departments: Department[];
  value?: string;
}) {
  return (
    <Field label="Department">
      <select name="department" defaultValue={value}>
        <option value="">No department / all report departments</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
