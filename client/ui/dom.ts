export type ElementLookup = <E extends HTMLElement = HTMLElement>(id: string) => E;

/** One page owns this cache; UI modules receive a lookup rather than importing the application. */
export function createElementLookup(root: Pick<Document, 'getElementById'>): ElementLookup {
  const cache = new Map<string, HTMLElement>();
  return <E extends HTMLElement = HTMLElement>(id: string): E => {
    let element = cache.get(id);
    if (!element) {
      const found = root.getElementById(id);
      if (!found) throw new Error(`Required UI element #${id} is missing.`);
      element = found;
      cache.set(id, element);
    }
    // The caller's element type is the checked-in HTML ID contract.
    return element as E;
  };
}

export function setText(element: Pick<HTMLElement, 'textContent'>, value: string): void {
  if (element.textContent !== value) element.textContent = value;
}
