import { SUBSCRIPTION_LIMITS } from '@/lib/subscriptionUtils';

describe('SUBSCRIPTION_LIMITS', () => {
  it('debe tener límites correctos para FREE, STARTER y PRO con Lemon Squeezy', () => {
    expect(SUBSCRIPTION_LIMITS.FREE.MAX_PROJECTS).toBe(3);
    expect(SUBSCRIPTION_LIMITS.STARTER.MAX_PROJECTS).toBe(5);
    expect(SUBSCRIPTION_LIMITS.PRO.MAX_PROJECTS).toBe(10);

    // No hay plan Enterprise, solo Lemon Squeezy con FREE, STARTER y PRO
  });

  it('debe tener límites correctos de miembros por proyecto', () => {
    expect(SUBSCRIPTION_LIMITS.FREE.MAX_MEMBERS_PER_PROJECT).toBe(10);
    expect(SUBSCRIPTION_LIMITS.STARTER.MAX_MEMBERS_PER_PROJECT).toBe(15);
    expect(SUBSCRIPTION_LIMITS.PRO.MAX_MEMBERS_PER_PROJECT).toBe(20);

    // No hay plan Enterprise, solo Lemon Squeezy con FREE, STARTER y PRO
  });
});
