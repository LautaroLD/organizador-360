export type ExportDataset =
  | 'tasks'
  | 'members'
  | 'checkins'
  | 'events'
  | 'analytics'
  | 'okrs'
  | 'resources';

export const EXPORT_DATASETS: ExportDataset[] = [
  'tasks',
  'members',
  'checkins',
  'events',
  'analytics',
  'okrs',
  'resources',
];

export type ProjectExportPayload = {
  exportedAt: string;
  project: {
    id: string;
    name: string;
    description: string | null;
  };
  tasks: Array<Record<string, unknown>>;
  members: Array<Record<string, unknown>>;
  checkins: Array<Record<string, unknown>>;
  events: Array<Record<string, unknown>>;
  analytics: Record<string, unknown>;
  okrs: {
    objectives: Array<Record<string, unknown>>;
    keyResults: Array<Record<string, unknown>>;
    epics: Array<Record<string, unknown>>;
  };
  resources: Array<Record<string, unknown>>;
};

export function escapeCsvValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str =
    typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function rowsToCsv(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '';
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const lines = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) =>
      headers.map((header) => escapeCsvValue(row[header])).join(','),
    ),
  ];

  return lines.join('\n');
}

export function parseExportDatasets(raw: string | null): ExportDataset[] {
  if (!raw || raw.trim() === '' || raw.trim() === 'all') {
    return [...EXPORT_DATASETS];
  }

  const requested = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);

  const valid = requested.filter((part): part is ExportDataset =>
    EXPORT_DATASETS.includes(part as ExportDataset),
  );

  return valid.length > 0 ? valid : [...EXPORT_DATASETS];
}

export function pickExportDatasets(
  payload: ProjectExportPayload,
  datasets: ExportDataset[],
): Record<string, unknown> {
  const picked: Record<string, unknown> = {
    exportedAt: payload.exportedAt,
    project: payload.project,
  };

  datasets.forEach((dataset) => {
    switch (dataset) {
      case 'tasks':
        picked.tasks = payload.tasks;
        break;
      case 'members':
        picked.members = payload.members;
        break;
      case 'checkins':
        picked.checkins = payload.checkins;
        break;
      case 'events':
        picked.events = payload.events;
        break;
      case 'analytics':
        picked.analytics = payload.analytics;
        break;
      case 'okrs':
        picked.okrs = payload.okrs;
        break;
      case 'resources':
        picked.resources = payload.resources;
        break;
      default:
        break;
    }
  });

  return picked;
}

export function buildCsvFiles(
  payload: ProjectExportPayload,
  datasets: ExportDataset[],
): Record<string, string> {
  const files: Record<string, string> = {};

  datasets.forEach((dataset) => {
    switch (dataset) {
      case 'tasks':
        files['tasks.csv'] = rowsToCsv(payload.tasks);
        break;
      case 'members':
        files['members.csv'] = rowsToCsv(payload.members);
        break;
      case 'checkins':
        files['checkins.csv'] = rowsToCsv(payload.checkins);
        break;
      case 'events':
        files['events.csv'] = rowsToCsv(payload.events);
        break;
      case 'analytics': {
        const analyticsRows = Object.entries(payload.analytics).map(
          ([metric, value]) => ({
            metric,
            value:
              typeof value === 'object' ? JSON.stringify(value) : (value ?? ''),
          }),
        );
        files['analytics.csv'] = rowsToCsv(analyticsRows);
        break;
      }
      case 'okrs':
        files['okr_objectives.csv'] = rowsToCsv(payload.okrs.objectives);
        files['okr_key_results.csv'] = rowsToCsv(payload.okrs.keyResults);
        files['okr_epics.csv'] = rowsToCsv(payload.okrs.epics);
        break;
      case 'resources':
        files['resources.csv'] = rowsToCsv(payload.resources);
        break;
      default:
        break;
    }
  });

  return files;
}

export function sanitizeFilenamePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || 'proyecto';
}
