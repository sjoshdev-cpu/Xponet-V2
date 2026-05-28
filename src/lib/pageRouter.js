/**
 * Determine the correct client-side route for a page document.
 *
 * Rules (in priority order):
 *  1. If the page IS a database container (page.is_database === true),
 *     resolve the matching Database record and route to /document-hub/:dbId.
 *  2. If the page is a record INSIDE a database (page.database_id is set),
 *     route to /document-hub/:databaseId.
 *  3. Otherwise route to the normal /page/:id editor.
 *
 * @param {Object}   page        - Page document. Must have `id`; optionally
 *                                 `is_database`, `database_id`.
 * @param {Object[]} databases   - All Database documents available. Each may
 *                                 have `id`, `page_id`, and `name`.
 * @returns {string} A React Router path string.
 */
export function getPageRoute(page, databases = []) {
  if (!page?.id) return '/';

  // Page that IS a database container (e.g. "Document Hub")
  if (page.is_database) {
    const db = databases.find(
      (d) => d.page_id === page.id || d.id === page.database_id,
    );
    if (db) return `/document-hub/${db.id}`;
    // Fallback: we know it's a database but don't have the record yet
    return '/document-hub';
  }

  // Page that is a record inside a database
  if (page.database_id) {
    return `/document-hub/${page.database_id}`;
  }

  // Regular page
  return `/page/${page.id}`;
}
