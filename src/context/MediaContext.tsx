import {
  collection, deleteDoc, deleteField, doc,
  onSnapshot, orderBy, query, setDoc, updateDoc,
} from "firebase/firestore";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { db } from "../lib/firebase";
import { useAuth } from "./AuthContext";

export interface MediaItem {
  id: string;
  title: string;
  type: "Movie" | "TV Series";
  status: "Watched" | "Want to Watch";
  rating?: number;
  genre?: string;
  poster?: string;
  tmdbId?: number;
  runtime?: number;
  numberOfEpisodes?: number;
  createdAt: number;
  list?: string;
}

export interface List {
  id: string;
  name: string;
  createdAt: number;
}

interface MediaContextType {
  media: MediaItem[];
  lists: List[];
  loading: boolean;
  addMedia: (item: Omit<MediaItem, "id" | "createdAt">) => Promise<void>;
  updateMedia: (id: string, updates: Partial<MediaItem>) => Promise<void>;
  deleteMedia: (id: string) => Promise<void>;
  toggleStatus: (id: string) => Promise<void>;
  createList: (name: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export const useMedia = (): MediaContextType => {
  const context = useContext(MediaContext);
  if (!context) throw new Error("useMedia must be used within a MediaProvider");
  return context;
};

export const MediaProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setMedia([]);
      setLists([]);
      setLoading(false);
      return;
    }

    // Subscribe to media
    const mediaQuery = query(collection(db, "users", user.uid, "media"), orderBy("createdAt", "desc"));
    const unsubMedia = onSnapshot(mediaQuery, { includeMetadataChanges: true }, (snap) => {
      const items: MediaItem[] = [];
      snap.forEach((d) => items.push(d.data() as MediaItem));
      if (!(snap.metadata.fromCache && items.length === 0)) {
        setMedia(items);
      }
      setLoading(false);
    });

    // Subscribe to lists
    const listsQuery = query(collection(db, "users", user.uid, "lists"), orderBy("createdAt", "desc"));
    const unsubLists = onSnapshot(listsQuery, (snap) => {
      const l: List[] = [];
      snap.forEach((d) => l.push(d.data() as List));
      setLists(l);
    });

    return () => {
      unsubMedia();
      unsubLists();
    };
  }, [user]);

  const addMedia = async (item: Omit<MediaItem, "id" | "createdAt">) => {
    if (!user) return;
    const newItem: MediaItem = { ...item, id: Date.now().toString(), createdAt: Date.now() };
    setMedia((prev) => [newItem, ...prev]);
    try {
      await setDoc(doc(db, "users", user.uid, "media", newItem.id), JSON.parse(JSON.stringify(newItem)));
    } catch (e) {
      console.error("[Media] Error adding:", e);
    }
  };

  const toggleStatus = async (id: string) => {
    if (!user) return;
    const item = media.find((m) => m.id === id);
    if (!item) return;
    const newStatus = item.status === "Watched" ? "Want to Watch" : "Watched";
    setMedia((prev) => prev.map((m) => (m.id === id ? { ...m, status: newStatus } : m)) as MediaItem[]);
    try {
      await updateDoc(doc(db, "users", user.uid, "media", id), { status: newStatus });
    } catch (e) {
      console.error("[Media] Error toggling:", e);
    }
  };

  const deleteMedia = async (id: string) => {
    if (!user) return;
    setMedia((prev) => prev.filter((m) => m.id !== id));
    try {
      await deleteDoc(doc(db, "users", user.uid, "media", id));
    } catch (e) {
      console.error("[Media] Error deleting:", e);
    }
  };

  const updateMedia = async (id: string, updates: Partial<MediaItem>) => {
    if (!user) return;
    setMedia((prev) =>
      prev.map((m) => {
        if (m.id !== id) return m;
        const newItem = { ...m, ...updates };
        Object.keys(updates).forEach((k) => {
          if (updates[k as keyof MediaItem] === undefined) delete (newItem as any)[k];
        });
        return newItem;
      })
    );
    try {
      const processed: any = { ...updates };
      Object.keys(processed).forEach((k) => {
        if (processed[k] === undefined) processed[k] = deleteField();
      });
      await updateDoc(doc(db, "users", user.uid, "media", id), processed);
    } catch (e) {
      console.error("[Media] Error updating:", e);
    }
  };

  const createList = async (name: string) => {
    if (!user) return;
    const newList: List = { id: Date.now().toString(), name, createdAt: Date.now() };
    try {
      await setDoc(doc(db, "users", user.uid, "lists", newList.id), newList);
    } catch (e) {
      console.error("[Media] Error creating list:", e);
    }
  };

  const deleteList = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "lists", id));
    } catch (e) {
      console.error("[Media] Error deleting list:", e);
    }
  };

  const value = useMemo(
    () => ({ media, lists, loading, addMedia, updateMedia, deleteMedia, toggleStatus, createList, deleteList }),
    [media, lists, loading]
  );

  return <MediaContext.Provider value={value}>{children}</MediaContext.Provider>;
};
