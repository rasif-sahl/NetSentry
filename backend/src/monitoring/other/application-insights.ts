export type ApplicationEvidence = {
  applicationId: string;
  seconds: number;
  lateNightSeconds: number;
};
/** Descriptive arithmetic only; no diagnosis, guessed missing data or incomparable percentage claim. */
export function applicationInsights(apps: ApplicationEvidence[]) {
  const rank = (field: 'seconds' | 'lateNightSeconds') =>
    apps
      .filter((a) => a[field] > 0)
      .slice()
      .sort(
        (a, b) =>
          b[field] - a[field] || a.applicationId.localeCompare(b.applicationId),
      )[0];
  const top = rank('seconds'),
    night = rank('lateNightSeconds');
  return [
    ...(top
      ? [
          {
            code: 'highest_observed_foreground',
            applicationId: top.applicationId,
            seconds: top.seconds,
            evidence:
              'Sum of accepted estimated foreground segments; not an attention or wellbeing diagnosis.',
          },
        ]
      : []),
    ...(night
      ? [
          {
            code: 'late_night_observed',
            applicationId: night.applicationId,
            seconds: night.lateNightSeconds,
            evidence:
              'Estimated observed foreground overlapping 22:00–06:00 in workspace time; missing periods are not inferred.',
          },
        ]
      : []),
  ];
}
