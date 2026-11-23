"use client";
import { usePage } from "@/shared/use-page";
import { PageControls } from "@/shared/ui/page-controls";
import { ActionFormDialog } from "@/shared/ui/action-form-dialog";
import {
  Card,
  Empty,
  Field,
  ErrorNotice,
  Loading,
  text,
} from "@/shared/ui/common";
import { useDeferredValue, useState } from "react";
import { DepartmentField } from "./department-field";
import type { BusinessSectionProps } from "./types";
import type { Location } from "./types";

export function BusinessStructure({
  data,
  options,
  can,
  mutate,
  base,
  location,
}: BusinessSectionProps & { base: string; location: string }) {
  const [search, setSearch] = useState("");
  const query = useDeferredValue(search.trim());
  const endpoints = usePage<BusinessSectionProps["data"]["endpoints"][number]>(
    can("networks:read")
      ? `${base}/endpoints/page?search=${encodeURIComponent(query)}${location ? `&locationId=${encodeURIComponent(location)}` : ""}`
      : null,
    true,
  );
  return (
    <>
      <Card title="Locations and network health">
        {data.locations.length === 0 && <Empty title="No locations yet" />}
        {data.locations.map((l) => (
          <div key={l.id} className="row">
            <strong>{l.name}</strong>
            {can("networks:manage") && (
              <ActionFormDialog
                label="Edit location"
                key={l.revision}
                action={async (f) => {
                  await mutate(`/locations/${l.id}`, "PATCH", {
                    name: text(f, "name"),
                    expectedRevision: l.revision,
                  });
                  return "Location renamed.";
                }}
                submit="Rename location"
              >
                <Field label={`Name for ${l.name}`}>
                  <input
                    name="name"
                    required
                    maxLength={100}
                    defaultValue={l.name}
                  />
                </Field>
              </ActionFormDialog>
            )}
          </div>
        ))}
        {can("networks:manage") && (
          <ActionFormDialog
            submit="Add location"
            primary
            action={async (f) => {
              await mutate("/locations", "POST", {
                name: text(f, "name"),
                expectedRevision: 0,
              });
              return "Location added.";
            }}
          >
            <Field label="New location name">
              <input name="name" required maxLength={100} />
            </Field>
          </ActionFormDialog>
        )}
        {data.networks.map((n) => (
          <div key={n.id} className="row">
            <strong>{n.name}</strong>
            <p>
              {n.freshCollectors > 0
                ? `${n.freshCollectors} recent collector observations`
                : "No fresh collector observation"}{" "}
              · {n.collectorCount} assigned collectors. Hardware/network
              reachability remains unverified.
            </p>
            {can("networks:manage") && (
              <ActionFormDialog
                submit="Assign network location"
                action={async (f) => {
                  await mutate(`/networks/${n.id}/location`, "PATCH", {
                    locationId: text(f, "location"),
                  });
                  endpoints.reload();
                  return "Network location saved.";
                }}
              >
                <Field label={`Location for ${n.name}`}>
                  <select
                    name="location"
                    required
                    defaultValue={n.locationId ?? ""}
                  >
                    <option value="" disabled>
                      Choose location
                    </option>
                    {options?.locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </Field>
              </ActionFormDialog>
            )}
          </div>
        ))}
        <p>
          Create networks and manage authorized collectors in Networks. One
          location can contain several networks.
        </p>
      </Card>
      <Card title="Departments">
        {data.departments.map((d) => (
          <div key={d.id} className="row">
            <strong>{d.name}</strong>
            <p>{options?.locations.find((l) => l.id === d.locationId)?.name}</p>
            {can("members:manage") && (
              <ActionFormDialog
                label="Edit department"
                key={d.revision}
                submit="Update department"
                action={async (f) => {
                  await mutate(`/departments/${d.id}`, "PATCH", {
                    name: text(f, "name"),
                    locationId: text(f, "location"),
                    expectedRevision: d.revision,
                  });
                  return "Department updated.";
                }}
              >
                <Field label={`Department name for ${d.name}`}>
                  <input
                    name="name"
                    defaultValue={d.name}
                    required
                    maxLength={100}
                  />
                </Field>
                <LocationField
                  locations={options?.locations ?? []}
                  value={d.locationId}
                />
              </ActionFormDialog>
            )}
          </div>
        ))}
        {can("members:manage") && (
          <ActionFormDialog
            submit="Add department"
            primary
            action={async (f) => {
              await mutate("/departments", "POST", {
                name: text(f, "name"),
                locationId: text(f, "location"),
                expectedRevision: 0,
              });
              return "Department added.";
            }}
          >
            <Field label="New department name">
              <input name="name" required maxLength={100} />
            </Field>
            <LocationField locations={options?.locations ?? []} />
          </ActionFormDialog>
        )}
      </Card>
      {can("networks:read") && (
        <Card title="Network device departments">
          <p>
            These are observed network endpoints, not verified ownership or
            employee identities. Assigning a department adds metadata; it does
            not measure per-device traffic.
          </p>
          <div className="mt-3">
            <Field label="Find an observed device">
              <input
                type="search"
                value={search}
                maxLength={200}
                onChange={(event) => setSearch(event.target.value)}
              />
            </Field>
          </div>
          <ErrorNotice error={endpoints.error} />
          {endpoints.loading && <Loading />}
          {endpoints.data?.length === 0 && (
            <Empty
              title={
                query ? "No matching devices" : "No network devices observed"
              }
            />
          )}
          {endpoints.data?.map((e) => (
            <div key={e.id} className="row">
              <strong>{e.name || "Unnamed observed device"}</strong>
              <p>
                {e.networkName} ·{" "}
                {options?.departments.find((d) => d.id === e.departmentId)
                  ?.name ?? "No department assigned"}
              </p>
              {can("networks:manage") && (
                <ActionFormDialog
                  submit="Assign network device department"
                  action={async (f) => {
                    await mutate(`/endpoints/${e.id}/department`, "PATCH", {
                      expectedRevision: e.revision,
                      ...(text(f, "department")
                        ? { departmentId: text(f, "department") }
                        : {}),
                    });
                    endpoints.reload();
                    return "Device department saved.";
                  }}
                >
                  <DepartmentField
                    departments={options?.departments ?? []}
                    value={e.departmentId ?? ""}
                  />
                </ActionFormDialog>
              )}
            </div>
          ))}
          <PageControls label="Business observed devices" page={endpoints} />
        </Card>
      )}
    </>
  );
}

function LocationField({
  locations,
  value = "",
}: {
  locations: Location[];
  value?: string;
}) {
  return (
    <Field label="Location">
      <select name="location" defaultValue={value} required>
        <option value="" disabled>
          Choose location
        </option>
        {locations.map((l) => (
          <option key={l.id} value={l.id}>
            {l.name}
          </option>
        ))}
      </select>
    </Field>
  );
}
