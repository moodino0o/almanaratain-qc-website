export function filterTypeaheadOptions(options: string[], inputValue: string) {
  const uniqueOptions = Array.from(
    options.reduce((unique, option) => {
      const trimmedOption = option.trim();
      const key = trimmedOption.toLocaleLowerCase();
      if (trimmedOption && !unique.has(key)) unique.set(key, trimmedOption);
      return unique;
    }, new Map<string, string>()).values(),
  );
  const normalizedInput = inputValue.trim().toLocaleLowerCase();

  if (!normalizedInput) return uniqueOptions;

  return uniqueOptions
    .filter((option) => option.toLocaleLowerCase().includes(normalizedInput))
    .sort((a, b) => {
      const aLower = a.toLocaleLowerCase();
      const bLower = b.toLocaleLowerCase();
      const aStarts = aLower.startsWith(normalizedInput);
      const bStarts = bLower.startsWith(normalizedInput);
      if (aStarts && !bStarts) return -1;
      if (!aStarts && bStarts) return 1;
      return aLower.localeCompare(bLower);
    });
}