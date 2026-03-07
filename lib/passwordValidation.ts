const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

export const PASSWORD_REQUIREMENTS_MESSAGE =
  'La contraseña debe tener al menos 8 caracteres e incluir minúsculas, mayúsculas, números y símbolos.';

export function isStrongPassword(password: string): boolean {
  return PASSWORD_STRENGTH_REGEX.test(password);
}

export function validatePasswordStrength(password: string): string | null {
  return isStrongPassword(password) ? null : PASSWORD_REQUIREMENTS_MESSAGE;
}
