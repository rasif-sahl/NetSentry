import { applicationInsights } from '../application-insights';
describe('descriptive application insights', () => {
  it('does not invent observations for empty or zero evidence', () => {
    expect(applicationInsights([])).toEqual([]);
    expect(
      applicationInsights([
        { applicationId: 'com.example.a', seconds: 0, lateNightSeconds: 0 },
      ]),
    ).toEqual([]);
  });
  it('ranks exact accepted values with deterministic ties and separate late-night evidence', () => {
    const insights = applicationInsights([
      { applicationId: 'com.example.b', seconds: 20, lateNightSeconds: 10 },
      { applicationId: 'com.example.a', seconds: 20, lateNightSeconds: 0 },
    ]);
    expect(insights.map((i) => [i.code, i.applicationId, i.seconds])).toEqual([
      ['highest_observed_foreground', 'com.example.a', 20],
      ['late_night_observed', 'com.example.b', 10],
    ]);
    expect(
      insights.every(
        (i) =>
          i.evidence.includes('estimated') || i.evidence.includes('Estimated'),
      ),
    ).toBe(true);
  });
});
