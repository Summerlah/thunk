import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ensureWorkspaceSeed } from "@/lib/seed";

export async function POST(request: Request) {
  const body = await request.json();
  const workspace = await ensureWorkspaceSeed();
  const prompt = String(body.prompt ?? "").trim();
  const pageId = body.pageId ?? null;

  const selectedPage = pageId
    ? await prisma.page.findUnique({
        where: { id: pageId },
        include: { tasks: true },
      })
    : null;

  const lower = prompt.toLowerCase();

  if (lower.includes("new page") || lower.includes("create a page") || lower.includes("create page")) {
    const match = prompt.match(/[“"]?([^“"]+)[“"]?$/) ?? prompt.match(/called\s+([a-z0-9\s-]+)/i);
    const title = (match?.[1] ?? "Project notes").trim() || "Project notes";
    const page = await prisma.page.create({
      data: {
        workspaceId: workspace.id,
        title,
        icon: "📝",
        content: `<h2>${title}</h2><p>Created by Thunk AI.</p>`,
      },
    });

    return NextResponse.json({
      message: `Created a new page titled “${title}”.`,
      page,
    });
  }

  if (lower.includes("new folder") || lower.includes("create a folder") || lower.includes("create folder")) {
    const match = prompt.match(/called\s+([a-z0-9\s-]+)/i) ?? prompt.match(/folder\s+([a-z0-9\s-]+)/i);
    const name = (match?.[1] ?? "New folder").trim() || "New folder";
    const folder = await prisma.folder.create({ data: { workspaceId: workspace.id, name } });

    return NextResponse.json({
      message: `Created a folder named “${name}”.`,
      folder,
    });
  }

  if (lower.includes("checklist") || lower.includes("todo") || lower.includes("task")) {
    const title = selectedPage?.title ?? "Action items";
    const taskNames = ["Draft the brief", "Review the requirements", "Share the plan"];

    const createdTasks = await Promise.all(
      taskNames.map((taskTitle) =>
        prisma.task.create({
          data: {
            workspaceId: workspace.id,
            pageId: selectedPage?.id ?? null,
            title: taskTitle,
          },
        }),
      ),
    );

    return NextResponse.json({
      message: `Created a checklist for “${title}” with ${createdTasks.length} tasks.`,
      tasks: createdTasks,
    });
  }

  const pageSummary = selectedPage
    ? `${selectedPage.title}: ${selectedPage.content.replace(/<[^>]+>/g, "").slice(0, 220)}`
    : "No page selected.";

  return NextResponse.json({
    message: `I reviewed the current workspace context. ${pageSummary}`,
  });
}
