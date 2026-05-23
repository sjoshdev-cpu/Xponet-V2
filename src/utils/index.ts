export const createPageUrl = (page: { id: string } | string): string =>
  `/page/${typeof page === 'string' ? page : page.id}`;
