import type { CommandBookmark } from "@/types";

const BOOKMARKS_STORAGE_KEY = "ai_terminal_bookmarks";

/**
 * Manages command bookmarks/favorites for quick access.
 */
export class BookmarkManager {
  private bookmarks: CommandBookmark[] = [];

  constructor() {
    this.load();
  }

  /** Get all bookmarks. */
  getAll(): CommandBookmark[] {
    return [...this.bookmarks];
  }

  /** Get bookmarks filtered by tag. */
  getByTag(tag: string): CommandBookmark[] {
    return this.bookmarks.filter((b) => b.tags.includes(tag));
  }

  /** Search bookmarks by name, command, or description. */
  search(query: string): CommandBookmark[] {
    const q = query.toLowerCase();
    return this.bookmarks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.command.toLowerCase().includes(q) ||
        b.description.toLowerCase().includes(q) ||
        b.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }

  /** Get all unique tags. */
  getTags(): string[] {
    const tags = new Set<string>();
    for (const b of this.bookmarks) {
      for (const t of b.tags) tags.add(t);
    }
    return Array.from(tags).sort();
  }

  /** Add a new bookmark. */
  add(bookmark: Omit<CommandBookmark, "id" | "createdAt">): CommandBookmark {
    const newBookmark: CommandBookmark = {
      ...bookmark,
      id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    this.bookmarks.unshift(newBookmark);
    this.save();
    return newBookmark;
  }

  /** Remove a bookmark by ID. */
  remove(id: string): boolean {
    const idx = this.bookmarks.findIndex((b) => b.id === id);
    if (idx === -1) return false;
    this.bookmarks.splice(idx, 1);
    this.save();
    return true;
  }

  /** Update a bookmark. */
  update(id: string, updates: Partial<Omit<CommandBookmark, "id" | "createdAt">>): boolean {
    const bookmark = this.bookmarks.find((b) => b.id === id);
    if (!bookmark) return false;
    Object.assign(bookmark, updates);
    this.save();
    return true;
  }

  /** Check if a command is bookmarked. */
  isBookmarked(command: string): boolean {
    return this.bookmarks.some((b) => b.command === command);
  }

  /** Get the bookmark for a command, if it exists. */
  getByCommand(command: string): CommandBookmark | undefined {
    return this.bookmarks.find((b) => b.command === command);
  }

  /** Export bookmarks as JSON string. */
  export(): string {
    return JSON.stringify(this.bookmarks, null, 2);
  }

  /** Import bookmarks from JSON string. */
  import(json: string): number {
    try {
      const imported: CommandBookmark[] = JSON.parse(json);
      let count = 0;
      for (const bm of imported) {
        if (bm.command && bm.name && !this.isBookmarked(bm.command)) {
          this.bookmarks.push({
            ...bm,
            id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            createdAt: bm.createdAt || Date.now(),
          });
          count++;
        }
      }
      if (count > 0) this.save();
      return count;
    } catch {
      return 0;
    }
  }

  private load(): void {
    try {
      const stored = localStorage.getItem(BOOKMARKS_STORAGE_KEY);
      if (stored) {
        this.bookmarks = JSON.parse(stored);
      }
    } catch {
      this.bookmarks = [];
    }
  }

  private save(): void {
    try {
      localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(this.bookmarks));
    } catch {
      // Storage full or unavailable
    }
  }
}

/** Singleton instance */
let _manager: BookmarkManager | null = null;

export function getBookmarkManager(): BookmarkManager {
  if (!_manager) {
    _manager = new BookmarkManager();
  }
  return _manager;
}
