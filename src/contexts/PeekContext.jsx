import { createContext, useContext, useState, useCallback } from 'react';

const PeekContext = createContext(null);

/**
 * PeekProvider — wraps the authenticated app shell.
 * Children call `usePeek().openPeek(pageId)` to trigger the side panel.
 */
export function PeekProvider({ children }) {
  const [peekPageId, setPeekPageId] = useState(null);

  const openPeek  = useCallback((pageId) => setPeekPageId(pageId), []);
  const closePeek = useCallback(() => setPeekPageId(null), []);

  return (
    <PeekContext.Provider value={{ peekPageId, openPeek, closePeek }}>
      {children}
    </PeekContext.Provider>
  );
}

export const usePeek = () => {
  const ctx = useContext(PeekContext);
  if (!ctx) throw new Error('usePeek must be used inside PeekProvider');
  return ctx;
};
