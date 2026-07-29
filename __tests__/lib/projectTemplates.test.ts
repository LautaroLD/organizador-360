import {
  GENERIC_MEMBER_ONBOARDING,
  ONBOARDING_TASK_TITLE,
  PROJECT_TEMPLATES,
  addDaysDateOnly,
  addDaysIso,
  computeOnboardingProgress,
  detectTemplateIdFromChannelNames,
  getTemplatePreviewStats,
  isProjectTemplateId,
  listProjectTemplates,
  tagsForRole,
} from '@/lib/projectTemplates';

describe('projectTemplates', () => {
  it('expone las 3 plantillas PRO con canales, fases, tags y onboarding', () => {
    const templates = listProjectTemplates();
    expect(templates.map((t) => t.id).sort()).toEqual([
      'agency',
      'product',
      'startup',
    ]);

    for (const template of templates) {
      expect(template.channels.length).toBeGreaterThan(0);
      expect(template.roleTags.length).toBeGreaterThan(0);
      expect(template.phases.length).toBeGreaterThanOrEqual(4);
      expect(template.seedTasks.length).toBeGreaterThanOrEqual(6);
      expect(template.suggestedDescription.length).toBeGreaterThan(0);
      expect(template.memberOnboarding.title).toBe(ONBOARDING_TASK_TITLE);
      expect(template.memberOnboarding.items.length).toBe(7);
      expect(template.seedTasks.some((t) => t.status === 'in-progress')).toBe(true);
      expect(template.seedTasks.some((t) => t.assignToActor)).toBe(true);
      expect(
        template.seedTasks.every(
          (t) => t.phaseIndex !== undefined && t.phaseIndex < template.phases.length,
        ),
      ).toBe(true);
    }
  });

  it('usa tags en español (o términos de industria) y no auto-asigna especialidades a Collaborator', () => {
    expect(PROJECT_TEMPLATES.startup.roleTags.map((t) => t.label).sort()).toEqual([
      'Crecimiento',
      'Fundador',
      'Ingeniería',
      'Observador',
    ]);
    expect(PROJECT_TEMPLATES.agency.roleTags.map((t) => t.label).sort()).toEqual([
      'Account',
      'Cliente',
      'Creativo',
      'Producción',
    ]);
    expect(PROJECT_TEMPLATES.product.roleTags.map((t) => t.label).sort()).toEqual([
      'Dev',
      'Diseño',
      'PM',
      'QA',
      'Stakeholder',
    ]);

    expect(tagsForRole(PROJECT_TEMPLATES.startup.roleTags, 'Collaborator')).toEqual([]);
    expect(tagsForRole(PROJECT_TEMPLATES.agency.roleTags, 'Collaborator')).toEqual([]);
    expect(tagsForRole(PROJECT_TEMPLATES.product.roleTags, 'Collaborator')).toEqual([]);

    expect(tagsForRole(PROJECT_TEMPLATES.startup.roleTags, 'Owner')).toEqual([
      expect.objectContaining({ label: 'Fundador' }),
    ]);
    expect(tagsForRole(PROJECT_TEMPLATES.product.roleTags, 'Viewer')).toEqual([
      expect.objectContaining({ label: 'Stakeholder' }),
    ]);
  });

  it('expone preview stats útiles', () => {
    const stats = getTemplatePreviewStats(PROJECT_TEMPLATES.startup);
    expect(stats.channels).toBe(3);
    expect(stats.phases).toBe(4);
    expect(stats.tasks).toBeGreaterThanOrEqual(6);
    expect(stats.onboardingDays).toBe(7);
  });

  it('valida ids de plantilla', () => {
    expect(isProjectTemplateId('startup')).toBe(true);
    expect(isProjectTemplateId('agency')).toBe(true);
    expect(isProjectTemplateId('product')).toBe(true);
    expect(isProjectTemplateId('blank')).toBe(false);
    expect(isProjectTemplateId(null)).toBe(false);
  });

  it('detecta plantilla por canales', () => {
    expect(
      detectTemplateIdFromChannelNames(['general', 'producto', 'growth', 'standup']),
    ).toBe('startup');
    expect(
      detectTemplateIdFromChannelNames(['general', 'clientes', 'creativos', 'entregas']),
    ).toBe('agency');
    expect(
      detectTemplateIdFromChannelNames([
        'general',
        'producto',
        'growth',
        'standup',
        'clientes',
        'creativos',
        'entregas',
      ]),
    ).toBe('startup');
    expect(detectTemplateIdFromChannelNames(['general'])).toBeNull();
  });

  it('calcula progreso de onboarding y overdue', () => {
    const progress = computeOnboardingProgress({
      userId: 'u1',
      taskId: 't1',
      status: 'todo',
      doneEstimatedAt: '2026-07-01T00:00:00.000Z',
      checklist: [
        { is_completed: true },
        { is_completed: true },
        { is_completed: false },
        { is_completed: false },
      ],
      now: new Date('2026-07-15T12:00:00.000Z'),
    });

    expect(progress.percent).toBe(50);
    expect(progress.completedItems).toBe(2);
    expect(progress.totalItems).toBe(4);
    expect(progress.isOverdue).toBe(true);
  });

  it('suma días para fechas ISO y date-only', () => {
    expect(addDaysIso(new Date('2026-07-15T10:00:00.000Z'), 7)).toBe(
      '2026-07-22T10:00:00.000Z',
    );
    expect(addDaysDateOnly(new Date(2026, 6, 15), 7)).toBe('2026-07-22');
  });

  it('tiene checklist genérico con 7 items', () => {
    expect(GENERIC_MEMBER_ONBOARDING.items).toHaveLength(7);
  });
});
