import { prisma } from "@/lib/prisma";

export async function ensureWorkspaceSeed() {
  let workspace = await prisma.workspace.findFirst({
    include: {
      folders: true,
      pages: { include: { tasks: true } },
      tasks: true,
      chats: { orderBy: { createdAt: "asc" } },
    },
  });

  if (workspace) return workspace;

  workspace = await prisma.workspace.create({
    data: {
      name: "Thunk Workspace",
      description: "A human-centered productivity workspace with notes, tasks, and AI-powered actions.",
      folders: {
        create: [{ name: "Projects" }, { name: "Research" }],
      },
      pages: {
        create: [
          {
            title: "Home",
            icon: "🏠",
            content:
              "<h1>Welcome to Thunk</h1><p>Think less about organizing. Do more with what you know.</p><ul><li>Capture ideas and refine them into plans.</li><li>Organize notes by folders and pages.</li><li>Use AI to create new structure and tasks.</li></ul>",
            favorite: true,
          },
          {
            title: "Q4 Launch Plan",
            icon: "🚀",
            content:
              "<h2>Q4 Launch Plan</h2><p>Focus on shipping the AI workspace alpha and collecting quality feedback.</p><ul><li>Finalize onboarding flow</li><li>Ship page creation actions</li><li>Review AI safety checks</li></ul>",
            favorite: true,
          },
          {
            title: "Authentication Notes",
            icon: "🔐",
            content:
              "<h2>Authentication Notes</h2><p>OAuth tokens should be scoped carefully and refreshed before expiry.</p><p>We need a strong session model and safe use of role-based permissions.</p>",
          },
        ],
      },
      tasks: {
        create: [
          { title: "Review AI action safety rules", done: false },
          { title: "Draft onboarding copy", done: true },
        ],
      },
      chats: {
        create: [
          { role: "assistant", content: "Welcome back. I can help organize your workspace and create pages, folders, and tasks." },
        ],
      },
    },
    include: {
      folders: true,
      pages: { include: { tasks: true } },
      tasks: true,
      chats: { orderBy: { createdAt: "asc" } },
    },
  });

  return workspace;
}
