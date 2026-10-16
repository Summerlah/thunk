"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import StarterKit from "@tiptap/starter-kit";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import Underline from "@tiptap/extension-underline";
import {
  Bell,
  Command,
  FileText,
  Folder,
  FolderPlus,
  Home,
  Inbox,
  LayoutGrid,
  MessageSquareText,
  MoreHorizontal,
  MoonStar,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  SunMedium,
  Trash2,
  Wand2,
} from "lucide-react";

type FolderItem = {
  id: string;
  name: string;
  parentId: string | null;
  workspaceId: string;
};

type TaskItem = {
  id: string;
  title: string;
  done: boolean;
};

type PageItem = {
  id: string;
  title: string;
  icon?: string | null;
  content: string;
  favorite: boolean;
  folderId?: string | null;
  tasks?: TaskItem[];
  updatedAt?: string;
};

type WorkspaceData = {
  id: string;
  name: string;
  description?: string | null;
  folders: FolderItem[];
  pages: PageItem[];
  tasks: TaskItem[];
  chats: Array<{ id: string; role: string; content: string }>; 
};

type Message = { role: "user" | "assistant"; content: string };

type CommandItem =
  | { label: string; action: "page" | "folder" | "ai" | "theme" | "search" }
  | { label: string; action: "open-page"; pageId: string };

type FolderNode = {
  id: string;
  name: string;
  parentId: string | null;
  children: FolderNode[];
};

const initialMessages: Message[] = [
  { role: "assistant", content: "Hi! I can create pages, folders, tasks, and summaries across your workspace." },
];

function buildFolderTree(folders: FolderItem[]): FolderNode[] {
  const map = new Map<string, FolderNode>();
  folders.forEach((folder) => {
    map.set(folder.id, { id: folder.id, name: folder.name, parentId: folder.parentId, children: [] });
  });

  const root: FolderNode[] = [];
  folders.forEach((folder) => {
    const node = map.get(folder.id)!;
    if (folder.parentId && map.has(folder.parentId)) {
      map.get(folder.parentId)!.children.push(node);
    } else {
      root.push(node);
    }
  });
  return root;
}

export default function HomePage() {
  const [workspace, setWorkspace] = useState<WorkspaceData | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("Home");
  const [draftIcon, setDraftIcon] = useState("🏠");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [aiOpen, setAiOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState("");
  const [aiInput, setAiInput] = useState("");
  const [aiMessages, setAiMessages] = useState<Message[]>(initialMessages);
  const [editorHtml, setEditorHtml] = useState("<p>Start writing…</p>");

  const applyPageDraft = useCallback((page: PageItem | null) => {
    if (!page) return;
    setDraftTitle(page.title);
    setDraftIcon(page.icon ?? "✍️");
    setEditorHtml(page.content || "<p>Start writing…</p>");
  }, []);

  const loadWorkspace = useCallback(async () => {
    const response = await fetch("/api/workspace");
    const data = await response.json();
    const nextWorkspace = data.workspace as WorkspaceData | null;
    setWorkspace(nextWorkspace);
    if (nextWorkspace?.pages?.length) {
      const nextPage = nextWorkspace.pages[0];
      setSelectedPageId((current) => current ?? nextPage.id);
      applyPageDraft(nextPage);
    }
  }, [applyPageDraft]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const response = await fetch("/api/workspace");
      const data = await response.json();

      if (!isMounted) return;
      const nextWorkspace = data.workspace as WorkspaceData | null;
      setWorkspace(nextWorkspace);
      if (nextWorkspace?.pages?.length) {
        const nextPage = nextWorkspace.pages[0];
        setSelectedPageId((current) => current ?? nextPage.id);
        applyPageDraft(nextPage);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [applyPageDraft]);

  const selectedPage = useMemo(
    () => workspace?.pages.find((page) => page.id === selectedPageId) ?? workspace?.pages[0] ?? null,
    [selectedPageId, workspace],
  );

  const handleSavePage = async () => {
    if (!selectedPage) return;

    setSaveStatus("saving");
    try {
      const response = await fetch("/api/workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "update-page",
          pageId: selectedPage.id,
          title: draftTitle || selectedPage.title,
          icon: draftIcon,
          content: editorHtml,
          favorite: selectedPage.favorite,
          folderId: selectedPage.folderId ?? null,
        }),
      });

      if (!response.ok) throw new Error("save failed");
      const data = (await response.json()) as { page?: PageItem };
      if (!data.page) throw new Error("save response did not include the updated page");
      const updatedPage = data.page;

      setWorkspace((current) =>
        current
          ? { ...current, pages: current.pages.map((page) => (page.id === updatedPage.id ? updatedPage : page)) }
          : current,
      );
      setSaveStatus("idle");
    } catch {
      setSaveStatus("error");
    }
  };

  const folderTree = useMemo(() => buildFolderTree(workspace?.folders ?? []), [workspace]);

  const groupedPages = useMemo(() => {
    const rootPages = workspace?.pages.filter((page) => !page.folderId) ?? [];
    const folderPages = new Map<string, PageItem[]>();
    workspace?.pages.forEach((page) => {
      if (page.folderId) {
        const current = folderPages.get(page.folderId) ?? [];
        current.push(page);
        folderPages.set(page.folderId, current);
      }
    });
    return { rootPages, folderPages };
  }, [workspace]);

  const commandItems = useMemo<CommandItem[]>(() => {
    const items: CommandItem[] = [
      { label: "Create page", action: "page" },
      { label: "Create folder", action: "folder" },
      { label: "Toggle AI panel", action: "ai" },
      { label: "Toggle theme", action: "theme" },
      { label: "Open search", action: "search" },
      ...((workspace?.pages ?? []).slice(0, 8).map((page) => ({
        label: `Open ${page.title}`,
        action: "open-page" as const,
        pageId: page.id,
      }))),
    ];

    return items.filter((item) => item.label.toLowerCase().includes(paletteQuery.toLowerCase()));
  }, [paletteQuery, workspace]);

  const selectPage = useCallback(
    (pageId: string) => {
      const nextPage = workspace?.pages.find((page) => page.id === pageId) ?? null;
      setSelectedPageId(pageId);
      applyPageDraft(nextPage);
    },
    [applyPageDraft, workspace],
  );

  const handleCreatePage = async (folderId?: string | null) => {
    const title = window.prompt("Page title", "New page");
    if (!title) return;
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "create-page", title, folderId: folderId ?? null }),
    });
    const data = await response.json();
    if (data.page) {
      await loadWorkspace();
      setSelectedPageId(data.page.id);
      applyPageDraft({
        ...data.page,
        content: data.page.content ?? "<p>Start writing…</p>",
        favorite: Boolean(data.page.favorite),
        tasks: data.page.tasks ?? [],
      });
    }
  };

  const handleCreateFolder = async () => {
    const name = window.prompt("Folder name", "New folder");
    if (!name) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "create-folder", name }),
    });
    await loadWorkspace();
  };

  const handleRename = async (kind: "page" | "folder", id: string) => {
    const currentName = kind === "page" ? workspace?.pages.find((page) => page.id === id)?.title : workspace?.folders.find((folder) => folder.id === id)?.name;
    const nextName = window.prompt("Rename item", currentName ?? "");
    if (!nextName) return;

    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "rename-item", pageId: kind === "page" ? id : undefined, folderId: kind === "folder" ? id : undefined, name: nextName }),
    });
    await loadWorkspace();
  };

  const handleDelete = async (kind: "page" | "folder", id: string) => {
    const confirmed = window.confirm(`Delete this ${kind}?`);
    if (!confirmed) return;
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: kind === "page" ? "delete-page" : "delete-folder", pageId: kind === "page" ? id : undefined, folderId: kind === "folder" ? id : undefined }),
    });
    await loadWorkspace();
  };

  const handleToggleFavorite = async (pageId: string, favorite: boolean) => {
    await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "toggle-favorite", pageId, favorite }),
    });
    await loadWorkspace();
  };

  const handleAiSend = async () => {
    if (!aiInput.trim()) return;

    const prompt = aiInput.trim();
    setAiInput("");
    setAiMessages((prev) => [...prev, { role: "user", content: prompt }]);

    const response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, pageId: selectedPage?.id ?? null }),
    });

    const data = await response.json();
    if (data.message) {
      setAiMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    }
    if (data.page) {
      await loadWorkspace();
      selectPage(data.page.id);
    }
    if (data.folder) {
      await loadWorkspace();
    }
  };

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const pageBreadcrumb = selectedPage ? ["Home", selectedPage.title] : ["Home"];
  const lastEditedLabel = selectedPage?.updatedAt ? new Date(selectedPage.updatedAt).toLocaleString() : "just now";

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)] transition-colors duration-200">
      <div className="flex min-h-screen">
        {sidebarOpen && (
          <aside className="w-[280px] border-r border-[var(--border)] bg-[var(--panel)] backdrop-blur-sm">
            <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)] shadow-sm">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold">Thunk</div>
                  <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">Workspace</div>
                </div>
              </div>
              <button className="rounded-full border border-[var(--border)] p-1.5" onClick={() => setSidebarOpen(false)}>
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3">
              <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm text-[var(--muted)]">
                <Search className="h-4 w-4" />
                <input
                  value={paletteQuery}
                  onChange={(event) => setPaletteQuery(event.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
                  placeholder="Quick search"
                />
              </div>
            </div>

            <div className="px-3 pb-2">
              <button
                onClick={() => handleCreatePage()}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95"
              >
                <Plus className="h-4 w-4" />
                New page
              </button>
            </div>

            <nav className="space-y-2 px-3 pb-4 text-sm">
              <SidebarButton icon={<Home className="h-4 w-4" />} label="Home" active />
              <SidebarButton icon={<Inbox className="h-4 w-4" />} label="Inbox" />
              <SidebarButton icon={<Star className="h-4 w-4" />} label="Favorites" />
              <SidebarButton icon={<Bell className="h-4 w-4" />} label="Recent" />
            </nav>

            <div className="px-3 pb-3">
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Folders</span>
                <button onClick={handleCreateFolder} className="text-[var(--accent)]">
                  <FolderPlus className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-1">
                {folderTree.map((folder) => renderFolder(folder, workspace, handleRename, handleDelete, selectedPageId, setSelectedPageId, groupedPages))}
              </div>

              {groupedPages.rootPages.length > 0 && (
                <div className="mt-4 space-y-1">
                  {groupedPages.rootPages.map((page) => (
                    <PageRow key={page.id} page={page} active={selectedPageId === page.id} onSelect={() => selectPage(page.id)} onRename={() => handleRename("page", page.id)} onDelete={() => handleDelete("page", page.id)} onFavorite={handleToggleFavorite} />
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}

        {!sidebarOpen && (
          <button
            className="fixed left-3 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] text-[var(--foreground)] shadow-sm"
            onClick={() => setSidebarOpen(true)}
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        <main className="flex-1">
          <header className="flex h-18 items-center justify-between border-b border-[var(--border)] bg-[var(--panel)] px-5 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <button className="rounded-lg border border-[var(--border)] p-2 text-[var(--foreground)]" onClick={() => setSidebarOpen((value) => !value)}>
                <LayoutGrid className="h-4 w-4" />
              </button>
              <nav className="flex items-center gap-2 text-sm text-[var(--muted)]">
                {pageBreadcrumb.map((crumb, index) => (
                  <div key={crumb + index} className="flex items-center gap-2">
                    {index > 0 && <span>›</span>}
                    <span className={index === pageBreadcrumb.length - 1 ? "text-[var(--foreground)]" : ""}>{crumb}</span>
                  </div>
                ))}
              </nav>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setAiOpen((value) => !value)} className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm font-medium">
                <Sparkles className="h-4 w-4 text-[var(--accent)]" />
                AI assistant
              </button>
              <button onClick={() => setTheme((value) => (value === "dark" ? "light" : "dark"))} className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-2">
                {theme === "dark" ? <SunMedium className="h-4 w-4" /> : <MoonStar className="h-4 w-4" />}
              </button>
              <button className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] p-2">
                <Settings className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div className="flex h-[calc(100vh-73px)]">
            <div className="flex-1 overflow-auto p-5">
              {selectedPage ? (
                <div className="mx-auto max-w-5xl space-y-5">
                  <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 shadow-sm">
                    <div className="flex items-center gap-3">
                      <button onClick={() => setDraftIcon((value) => (value === "🏠" ? "✍️" : value))} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-2xl">
                        {draftIcon}
                      </button>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">Page</div>
                        <input
                          value={draftTitle}
                          onChange={(event) => setDraftTitle(event.target.value)}
                          className="w-full bg-transparent text-2xl font-semibold text-[var(--foreground)] outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm font-medium">
                        Share
                      </button>
                      <button className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm font-medium">
                        Export
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--panel)] px-4 py-3 text-sm text-[var(--muted)]">
                    <div className="flex items-center gap-2">
                      {saveStatus === "error" && <span role="status" className="text-red-500">Error saving</span>}
                      <span>Updated {lastEditedLabel}</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleSavePage}
                        disabled={saveStatus === "saving"}
                        className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {saveStatus === "saving" ? "Saving..." : saveStatus === "error" ? "Retry save" : "Save"}
                      </button>
                      <button onClick={() => handleCreatePage(selectedPage.folderId ?? null)} className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm font-medium">
                        New page
                      </button>
                      <button onClick={() => handleToggleFavorite(selectedPage.id, selectedPage.favorite)} className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-sm font-medium">
                        {selectedPage.favorite ? "Unfavorite" : "Favorite"}
                      </button>
                    </div>
                  </div>

                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-[var(--shadow)]">
                    <EditorHost
                      content={editorHtml}
                      onContentChange={setEditorHtml}
                    />
                  </div>

                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold">Tasks</span>
                      <button className="text-[var(--accent)]">Add task</button>
                    </div>
                    <div className="space-y-2">
                      {(selectedPage.tasks ?? []).length ? (
                        (selectedPage.tasks ?? []).map((task) => (
                          <div key={task.id} className="flex items-center justify-between rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2">
                            <label className="flex items-center gap-2 text-sm">
                              <input type="checkbox" checked={task.done} readOnly className="h-4 w-4" />
                              <span className={task.done ? "line-through text-[var(--muted)]" : ""}>{task.title}</span>
                            </label>
                            <button className="text-[var(--muted)]"><MoreHorizontal className="h-4 w-4" /></button>
                          </div>
                        ))
                      ) : (
                        <div className="rounded-xl border border-dashed border-[var(--border)] px-3 py-6 text-center text-sm text-[var(--muted)]">
                          No tasks yet for this page.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="rounded-3xl border border-[var(--border)] bg-[var(--panel)] p-10 text-center shadow-sm">
                    <FileText className="mx-auto mb-4 h-10 w-10 text-[var(--accent)]" />
                    <h2 className="text-xl font-semibold">Select a page</h2>
                    <p className="mt-2 text-sm text-[var(--muted)]">Create a page or open one from the sidebar to start writing.</p>
                  </div>
                </div>
              )}
            </div>

            {aiOpen && (
              <aside className="w-[360px] border-l border-[var(--border)] bg-[var(--panel)]">
                <div className="flex items-center justify-between border-b border-[var(--border)] p-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                      <Wand2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">Thunk AI</div>
                      <div className="text-[10px] uppercase tracking-[0.2em] text-[var(--muted)]">Context aware</div>
                    </div>
                  </div>
                  <button className="text-[var(--muted)]" onClick={() => setAiOpen(false)}>
                    <PanelLeftClose className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex h-[calc(100%-118px)] flex-col gap-3 p-3">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-[var(--muted)]">
                    Page: {selectedPage?.title ?? "Untitled"}
                  </div>
                  <div className="space-y-3 overflow-auto p-1">
                    {aiMessages.map((message, index) => (
                      <div key={`${message.role}-${index}`} className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${message.role === "assistant" ? "bg-[var(--panel-strong)] text-[var(--foreground)]" : "ml-auto bg-[var(--accent)] text-white"}`}>
                        {message.content}
                      </div>
                    ))}
                  </div>
                  <div className="mt-auto space-y-3">
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Create a new page called Project Roadmap",
                        "Summarize this page",
                        "Create a checklist from this note",
                      ].map((prompt) => (
                        <button key={prompt} onClick={() => setAiInput(prompt)} className="rounded-full border border-[var(--border)] bg-[var(--panel-strong)] px-3 py-1.5 text-xs text-[var(--muted)]">
                          {prompt}
                        </button>
                      ))}
                    </div>
                    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-2">
                      <textarea
                        value={aiInput}
                        onChange={(event) => setAiInput(event.target.value)}
                        rows={3}
                        placeholder="Ask Thunk to organize or create work…"
                        className="w-full resize-none bg-transparent p-2 text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                      />
                      <div className="flex items-center justify-between px-2 pb-1 pt-2">
                        <div className="flex items-center gap-2 text-[11px] text-[var(--muted)]">
                          <Command className="h-3.5 w-3.5" />
                          Enter to send
                        </div>
                        <button onClick={handleAiSend} className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white">
                          Send
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </aside>
            )}
          </div>
        </main>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-30 flex items-start justify-center bg-black/30 p-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--border)] bg-[var(--panel-strong)] p-3 shadow-[var(--shadow)]">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--panel)] px-3 py-2">
              <Search className="h-4 w-4 text-[var(--muted)]" />
              <input
                autoFocus
                value={paletteQuery}
                onChange={(event) => setPaletteQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setPaletteOpen(false);
                }}
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Search pages, folders, or actions…"
              />
            </div>

            <div className="mt-3 space-y-1">
              {commandItems.length > 0 ? (
                commandItems.map((item) => (
                  <button
                    key={`${item.label}-${item.action}`}
                    onClick={() => {
                      if (item.action === "page") handleCreatePage();
                      if (item.action === "folder") handleCreateFolder();
                      if (item.action === "ai") setAiOpen(true);
                      if (item.action === "theme") setTheme((value) => (value === "dark" ? "light" : "dark"));
                      if (item.action === "search") setPaletteOpen(false);
                      if (item.action === "open-page" && item.pageId) {
                        selectPage(item.pageId);
                        setPaletteOpen(false);
                      }
                    }}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm hover:bg-[var(--panel)]"
                  >
                    <span>{item.label}</span>
                    <span className="text-[var(--muted)]">{item.action === "page" ? "⌘N" : item.action === "folder" ? "⌘⇧N" : "↵"}</span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-4 text-sm text-[var(--muted)]">No matches found.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EditorHost({
  content,
  onContentChange,
}: {
  content: string;
  onContentChange: (next: string) => void;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
      Placeholder.configure({ placeholder: "Write something focused…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none text-[15px] leading-7 text-[var(--foreground)] dark:prose-invert",
      },
    },
    content,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onContentChange(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (editor.getHTML() !== content) {
      editor.commands.setContent(content || "<p>Start writing…</p>");
    }
  }, [content, editor]);

  return <EditorContent editor={editor} className="min-h-[420px]" />;
}

function SidebarButton({
  label,
  icon,
  active,
}: {
  label: string;
  icon: React.ReactNode;
  active?: boolean;
}) {
  return (
    <button className={`flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left ${active ? "bg-[var(--panel-strong)] text-[var(--foreground)]" : "text-[var(--muted)] hover:bg-[var(--panel-strong)]"}`}>
      {icon}
      <span>{label}</span>
    </button>
  );
}

function renderFolder(
  folder: FolderNode,
  workspace: WorkspaceData | null,
  onRename: (kind: "page" | "folder", id: string) => void,
  onDelete: (kind: "page" | "folder", id: string) => void,
  selectedPageId: string | null,
  setSelectedPageId: (id: string) => void,
  groupedPages: { folderPages: Map<string, PageItem[]>; rootPages: PageItem[] },
) {
  const pages = groupedPages.folderPages.get(folder.id) ?? [];

  return (
    <div key={folder.id} className="space-y-1">
      <div className="group flex items-center justify-between rounded-xl px-2 py-1.5 hover:bg-[var(--panel-strong)]">
        <button className="flex flex-1 items-center gap-2 text-left text-sm text-[var(--foreground)]">
          <Folder className="h-4 w-4 text-[var(--muted)]" />
          <span>{folder.name}</span>
        </button>
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button onClick={() => onRename("folder", folder.id)} className="rounded p-1 text-[var(--muted)]"><MessageSquareText className="h-3.5 w-3.5" /></button>
          <button onClick={() => onDelete("folder", folder.id)} className="rounded p-1 text-[var(--muted)]"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>

      <div className="ml-4 space-y-1">
        {pages.map((page) => (
          <PageRow key={page.id} page={page} active={selectedPageId === page.id} onSelect={() => selectPage(page.id)} onRename={() => onRename("page", page.id)} onDelete={() => onDelete("page", page.id)} onFavorite={async (pageId, favorite) => {
            await fetch("/api/workspace", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ type: "toggle-favorite", pageId, favorite }),
            });
            window.location.reload();
          }} />
        ))}
        {folder.children.map((child) => renderFolder(child, workspace, onRename, onDelete, selectedPageId, setSelectedPageId, groupedPages))}
      </div>
    </div>
  );
}

function PageRow({
  page,
  active,
  onSelect,
  onRename,
  onDelete,
  onFavorite,
}: {
  page: PageItem;
  active: boolean;
  onSelect: () => void;
  onRename: () => void;
  onDelete: () => void;
  onFavorite: (pageId: string, favorite: boolean) => Promise<void>;
}) {
  return (
    <div className={`group flex items-center justify-between rounded-xl px-2 py-1.5 ${active ? "bg-[var(--panel-strong)]" : "hover:bg-[var(--panel-strong)]"}`}>
      <button onClick={onSelect} className="flex flex-1 items-center gap-2 text-left text-sm text-[var(--foreground)]">
        <FileText className="h-3.5 w-3.5 text-[var(--muted)]" />
        <span className="truncate">{page.title}</span>
      </button>
      <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
        <button onClick={() => onFavorite(page.id, page.favorite)} className="rounded p-1 text-[var(--muted)]">
          <Star className={`h-3.5 w-3.5 ${page.favorite ? "fill-current text-yellow-400" : ""}`} />
        </button>
        <button onClick={onRename} className="rounded p-1 text-[var(--muted)]"><MessageSquareText className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="rounded p-1 text-[var(--muted)]"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
