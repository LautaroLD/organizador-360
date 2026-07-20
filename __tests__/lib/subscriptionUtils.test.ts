import {
  FALLBACK_PLAN_LIMITS,
  buildDisplayFeatures,
  getFallbackPlanLimits,
  mergePlanLimits,
  parsePlanLimits,
} from '@/lib/subscriptionUtils';

describe('plan limits helpers', () => {
  it('exposes fallback limits aligned with current product values', () => {
    expect(FALLBACK_PLAN_LIMITS.free.max_projects).toBe(3);
    expect(FALLBACK_PLAN_LIMITS.starter.max_projects).toBe(5);
    expect(FALLBACK_PLAN_LIMITS.pro.max_projects).toBe(10);

    expect(FALLBACK_PLAN_LIMITS.free.max_members_per_project).toBe(10);
    expect(FALLBACK_PLAN_LIMITS.starter.max_members_per_project).toBe(15);
    expect(FALLBACK_PLAN_LIMITS.pro.max_members_per_project).toBe(30);

    expect(FALLBACK_PLAN_LIMITS.pro.ai_features_enabled).toBe(true);
    expect(FALLBACK_PLAN_LIMITS.starter.ai_features_enabled).toBe(false);
  });

  it('getFallbackPlanLimits returns tier limits', () => {
    expect(getFallbackPlanLimits('pro').max_storage_bytes).toBe(
      5 * 1024 * 1024 * 1024,
    );
  });

  it('parsePlanLimits merges unknown payloads with defaults', () => {
    const parsed = parsePlanLimits({
      max_projects: 7,
      ai_features_enabled: true,
    });

    expect(parsed.max_projects).toBe(7);
    expect(parsed.ai_features_enabled).toBe(true);
    expect(parsed.max_members_per_project).toBe(10);
  });

  it('mergePlanLimits applies partial variant overrides', () => {
    const merged = mergePlanLimits(FALLBACK_PLAN_LIMITS.pro, {
      max_storage_bytes: 20 * 1024 * 1024 * 1024,
    });

    expect(merged.max_storage_bytes).toBe(20 * 1024 * 1024 * 1024);
    expect(merged.max_projects).toBe(10);
    expect(merged.ai_features_enabled).toBe(true);
  });

  it('buildDisplayFeatures updates quota lines from effective limits', () => {
    const features = buildDisplayFeatures(
      {
        ...FALLBACK_PLAN_LIMITS.pro,
        max_storage_bytes: 20 * 1024 * 1024 * 1024,
      },
      [
        'Hasta 10 proyectos',
        'Canales y chat ilimitados',
        'Hasta 5 GB de recursos',
        'Hasta 30 miembros por proyecto',
        'Asistente IA con Gemini',
      ],
    );

    expect(features).toContain('Hasta 10 proyectos');
    expect(features).toContain('Hasta 20 GB de recursos');
    expect(features).toContain('Hasta 30 miembros por proyecto');
    expect(features).toContain('Canales y chat ilimitados');
    expect(features).toContain('Asistente IA con Gemini');
    expect(features).not.toContain('Hasta 5 GB de recursos');
  });
});
