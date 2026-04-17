// Session-scoped "I found it in store" list.
//
// Found items are deliberately NOT persisted to the backend — they're a
// gentle nudge ("nice, you grabbed it") not a commitment. Kept in a tiny
// pub/sub store so the ProductDetailModal can push and the SummaryScreen
// can subscribe without prop-drilling through navigation.

export type FoundItem = {
  id: string;
  name: string;
  brand: string | null;
  price: number | null;
  image_url: string | null;
  found_at: number; // ms epoch
};

let items: FoundItem[] = [];
const listeners = new Set<() => void>();

export const foundStore = {
  list(): FoundItem[] {
    return items;
  },
  add(item: Omit<FoundItem, "found_at">) {
    if (items.some((x) => x.id === item.id)) return;
    items = [{ ...item, found_at: Date.now() }, ...items];
    listeners.forEach((l) => l());
  },
  remove(id: string) {
    items = items.filter((x) => x.id !== id);
    listeners.forEach((l) => l());
  },
  clear() {
    items = [];
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
};
