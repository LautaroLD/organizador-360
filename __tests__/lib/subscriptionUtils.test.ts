import { SUBSCRIPTION_LIMITS } from '@/lib/subscriptionUtils';

describe('SUBSCRIPTION_LIMITS', () => {
  it('debe tener 3 proyectos para FREE y 10 para PRO', () => {
    expect(SUBSCRIPTION_LIMITS.FREE.MAX_PROJECTS).toBe(3);
    expect(SUBSCRIPTION_LIMITS.PRO.MAX_PROJECTS).toBe(10);
  });

  it('debe tener 10 miembros por proyecto para FREE y 20 para PRO', () => {
    expect(SUBSCRIPTION_LIMITS.FREE.MAX_MEMBERS_PER_PROJECT).toBe(10);
    expect(SUBSCRIPTION_LIMITS.PRO.MAX_MEMBERS_PER_PROJECT).toBe(20);
  });
    it('debe tener límites correctos por plan', () => {
      expect(SUBSCRIPTION_LIMITS.FREE.MAX_PROJECTS).toBe(3);
      expect(SUBSCRIPTION_LIMITS.STARTER.MAX_PROJECTS).toBe(5);
      expect(SUBSCRIPTION_LIMITS.PRO.MAX_PROJECTS).toBe(10);
      expect(SUBSCRIPTION_LIMITS.ENTERPRISE.MAX_PROJECTS).toBeNull();

      expect(SUBSCRIPTION_LIMITS.FREE.MAX_MEMBERS_PER_PROJECT).toBe(10);
      expect(SUBSCRIPTION_LIMITS.STARTER.MAX_MEMBERS_PER_PROJECT).toBe(15);
      expect(SUBSCRIPTION_LIMITS.PRO.MAX_MEMBERS_PER_PROJECT).toBe(20);
      expect(SUBSCRIPTION_LIMITS.ENTERPRISE.MAX_MEMBERS_PER_PROJECT).toBeNull();
    });
});
