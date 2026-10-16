import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { ensureWorkspaceSeed } from "@/lib/seed";

export async function GET() {
  const workspace = await ensureWorkspaceSeed();

  const data = await prisma.workspace.findUnique({
    where: { id: workspace.id },
    include: {
      folders: { orderBy: { createdAt: "asc" } },
      pages: { orderBy: { updatedAt: "desc" }, include: { tasks: true } },
      tasks: { orderBy: { createdAt: "asc" } },
      chats: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!data) return NextResponse.json({ workspace: null, error: "No workspace found" });

  return NextResponse.json({ workspace: data });
}

export async function POST(request: Request) {
  const payload = await request.json();
  const workspace = await ensureWorkspaceSeed();

  switch (payload.type) {
    case "create-page": {
      const page = await prisma.page.create({
        data: {
          workspaceId: workspace.id,
          title: payload.title ?? "Untitled page",
          content: payload.content ?? "<p>Start writing…</p>",
          icon: payload.icon ?? "✍️",
          folderId: payload.folderId ?? null,
        },
        include: { tasks: true },
      });
      return NextResponse.json({ page });
    }
    case "create-folder": {
      const folder = await prisma.folder.create({
        data: {
          workspaceId: workspace.id,
          name: payload.name ?? "New folder",
          parentId: payload.parentId ?? null,
        },
      });
      return NextResponse.json({ folder });
    }
    case "update-page": {
      const page = await prisma.page.update({
        where: { id: payload.pageId },
        data: {
          title: payload.title,
          content: payload.content,
          icon: payload.icon,
          favorite: payload.favorite,
          folderId: payload.folderId ?? null,
        },
        include: { tasks: true },
      });
      return NextResponse.json({ page });
    }
    case "toggle-favorite": {
      const page = await prisma.page.update({
        where: { id: payload.pageId },
        data: { favorite: !payload.favorite },
        include: { tasks: true },
      });
      return NextResponse.json({ page });
    }
    case "delete-page": {
      const page = await prisma.page.delete({ where: { id: payload.pageId } });
      return NextResponse.json({ deleted: page.id });
    }
    case "delete-folder": {
      const folder = await prisma.folder.delete({ where: { id: payload.folderId } });
      return NextResponse.json({ deleted: folder.id });
    }
    case "rename-item": {
      if (payload.folderId) {
        const folder = await prisma.folder.update({
          where: { id: payload.folderId },
          data: { name: payload.name },
        });
        return NextResponse.json({ folder });
      }
      const page = await prisma.page.update({
        where: { id: payload.pageId },
        data: { title: payload.name },
        include: { tasks: true },
      });
      return NextResponse.json({ page });
    }
    default:
      return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }
}
