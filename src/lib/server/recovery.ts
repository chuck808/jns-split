export function recoveryToken(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9]{40,128}$/i.test(value) ? value : null;
}
export function passwordProblem(password: string, confirmation: string): string | null {
  if (password.length < 12 || password.length > 1024)
    return 'Use a password of 12–1024 characters.';
  if (password !== confirmation) return 'The passwords do not match.';
  return null;
}
