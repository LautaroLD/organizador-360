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
});
