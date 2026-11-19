export type Profile = {
  id: string;
  name: string;
  avatar: string;
  ageBand: string;
  userId: string | null;
  guardians: string[];
  networks: string[];
  archived: boolean;
  revision: number;
};
export type Rules = {
  enabled: boolean;
  dailyMinutes: number | null;
  appLimits: { id: string; minutes: number }[];
  categoryLimits: {
    id: string;
    minutes: number;
    purpose?: "education" | "entertainment" | "other";
  }[];
  allowedApps: string[];
  restrictedApps: string[];
  schedules: {
    kind: "bedtime" | "study" | "weekend";
    days: number[];
    start: string;
    end: string;
  }[];
  pauseUntil: string | null;
  networkPause: boolean;
  domains: string[];
  domainCategories: string[];
};
export type FamilyView = {
  profile: Profile;
  canManage: boolean;
  canRequest: boolean;
  policy: null | { revision: number; rules: Rules; timezone: string };
  desired: { state: string; reasons: string[]; warnings: string[] };
  overrideUntil: string | null;
  disclosure: { text: string };
  report: {
    from: string;
    to: string;
    confidence: string;
    evidence: string;
    currentWeekMinutes: number;
    previousWeekMinutes: number;
    comparisonPercent: number | null;
    educationMinutes: number;
    entertainmentMinutes: number;
    suggestions: string[];
    applicationTrends: {
      id: string;
      currentMinutes: number;
      previousMinutes: number;
    }[];
    categoryTrends: {
      id: string;
      currentMinutes: number;
      previousMinutes: number;
    }[];
    days: {
      date: string;
      minutes: number;
      coverageMinutes: number;
      lateNightMinutes: number;
    }[];
  };
  devices: {
    deviceId: string;
    name: string;
    platform: string;
    enforcement: string;
    consentedAt: string;
    receivedAt: string | null;
  }[];
  requests: {
    id: string;
    reason: string;
    minutes: number;
    state: string;
    requestedAt: string;
    overrideUntil: string | null;
  }[];
  timeline: {
    id: string;
    kind: string;
    occurredAt: string;
    detail: Record<string, unknown>;
  }[];
};
