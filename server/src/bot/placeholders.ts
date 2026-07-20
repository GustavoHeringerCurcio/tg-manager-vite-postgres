const USER_PLACEHOLDER_REGEX = /\{name(?::([^}]*))?\}/g;

export function resolveUserPlaceholders(text: string, user: { firstName: string | null }): string {
  return text.replace(USER_PLACEHOLDER_REGEX, (_match, fallback?: string) => {
    if (user.firstName?.trim()) return user.firstName.trim();
    return fallback?.trim() ?? "";
  });
}
