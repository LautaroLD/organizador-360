import {
  PASSWORD_REQUIREMENTS_MESSAGE,
  isStrongPassword,
  validatePasswordStrength,
} from '@/lib/passwordValidation';

describe('passwordValidation', () => {
  it('acepta una contraseña fuerte válida', () => {
    expect(isStrongPassword('Aa123456!')).toBe(true);
    expect(validatePasswordStrength('Aa123456!')).toBeNull();
  });

  it('rechaza contraseñas sin minúsculas', () => {
    expect(isStrongPassword('AA123456!')).toBe(false);
    expect(validatePasswordStrength('AA123456!')).toBe(PASSWORD_REQUIREMENTS_MESSAGE);
  });

  it('rechaza contraseñas sin mayúsculas', () => {
    expect(isStrongPassword('aa123456!')).toBe(false);
    expect(validatePasswordStrength('aa123456!')).toBe(PASSWORD_REQUIREMENTS_MESSAGE);
  });

  it('rechaza contraseñas sin números', () => {
    expect(isStrongPassword('Aaabcdef!')).toBe(false);
    expect(validatePasswordStrength('Aaabcdef!')).toBe(PASSWORD_REQUIREMENTS_MESSAGE);
  });

  it('rechaza contraseñas sin símbolos', () => {
    expect(isStrongPassword('Aa1234567')).toBe(false);
    expect(validatePasswordStrength('Aa1234567')).toBe(PASSWORD_REQUIREMENTS_MESSAGE);
  });

  it('rechaza contraseñas menores a 8 caracteres', () => {
    expect(isStrongPassword('Aa1!abc')).toBe(false);
    expect(validatePasswordStrength('Aa1!abc')).toBe(PASSWORD_REQUIREMENTS_MESSAGE);
  });
});
