export function appTitle(name?: string | null): string {
  const clean = name?.trim();
  return clean && clean !== '친구' ? `${clean} 한글나라` : '한글나라';
}
