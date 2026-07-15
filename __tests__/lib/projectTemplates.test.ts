import {
  GENERIC_MEMBER_ONBOARDING,
  ONBOARDING_TASK_TITLE,
  PROJECT_TEMPLATES,
  addDaysIso,
  computeOnboardingProgress,
  detectTemplateIdFromChannelNames,
  isProjectTemplateId,
  listProjectTemplates,
  tagsForRole,
} from '@/lib/projectTemplates';

describe('projectTemplates', () => {
  it('expone las 3 plantillas PRO con canales, tags y onboarding', () => {
    const templates = listProjectTemplates();
    expect(templates.map((t) => t.id).sort()).toEqual([
      'agency',
      'product',
      'startup',
    ]);

    for (const template of templates) {
      expect(template.channels.length).toBeGreaterThan(0);
      expect(template.roleTags.length).toBeGreaterThan(0);
      expect(template.seedTasks.length).toBeGreaterThan(0);
      expect(template.memberOnboarding.title).toBe(ONBOARDING_TASK_TITLE);
      expect(template.memberOnboarding.items.length).toBe(7);
    }
  });

  it('todas las plantillas dejan seed tasks en todo y tags de rol útiles', () => {
    for (const template of listProjectTemplates()) {
      expect(template.seedTasks.every((t) => t.status === 'todo')).toBe(true);
      expect(
        template.roleTags.every((t) => !t.label.toLowerCase().startsWith('plantilla')),
      ).toBe(true);
    }

    expect(PROJECT_TEMPLATES.startup.roleTags.map((t) => t.label).sort()).toEqual([
      'Engineering',
      'Founder',
      'Growth',
      'Observador',
    ]);
    expect(PROJECT_TEMPLATES.agency.roleTags.map((t) => t.label).sort()).toEqual([
      'Account',
      'Cliente',
      'Creativo',
      'Producción',
    ]);
    expect(PROJECT_TEMPLATES.product.roleTags.map((t) => t.label).sort()).toEqual([
      'Design',
      'Dev',
      'PM',
      'QA',
      'Stakeholder',
    ]);
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

  it('mapea tags por rol', () => {
    const tags = tagsForRole(PROJECT_TEMPLATES.product.roleTags, 'Collaborator');
    const labels = tags.map((t) => t.label).sort();
    expect(labels).toEqual(['Design', 'Dev', 'QA']);
    expect(tagsForRole(PROJECT_TEMPLATES.product.roleTags, 'Viewer')).toEqual([
      expect.objectContaining({ label: 'Stakeholder' }),
    ]);
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

  it('suma 7 días para la ventana de onboarding', () => {
    expect(addDaysIso(new Date('2026-07-15T10:00:00.000Z'), 7)).toBe(
      '2026-07-22T10:00:00.000Z',
    );
  });

  it('tiene checklist genérico con 7 items', () => {
    expect(GENERIC_MEMBER_ONBOARDING.items).toHaveLength(7);
  });
});
