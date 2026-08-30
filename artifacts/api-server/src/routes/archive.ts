import { Readable } from "stream";
import {
  CreateArchiveDocumentBody,
  CreateArchiveDocumentResponse,
  GetArchiveDocumentResponse,
  ListArchiveResponse,
  RetireArchiveDocumentParams,
} from "@workspace/api-zod";
import { archiveDocumentsTable, db } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectNotFoundError, ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const allowedExtensions = new Set(["pdf", "doc", "docx", "xls", "xlsx"]);
const maxFileSize = 25 * 1024 * 1024;

function getArchiveManagerEmails(): Set<string> {
  return new Set(
    (process.env.ARCHIVE_MANAGER_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}
function requireUser(req: Request, res: Response): boolean {
  if (!req.isAuthenticated()) {
    res.status(401).json({ error: "Authentication required" });
    return false;
  }
  return true;
}

function requireArchiveManager(req: Request, res: Response): boolean {
  if (!requireUser(req, res)) return false;
  const email = req.user?.email?.trim().toLowerCase();
  if (!email || !getArchiveManagerEmails().has(email)) {
    res.status(403).json({ error: "Archive manager access required" });
    return false;
  }
  return true;
}
function toDocument(row: typeof archiveDocumentsTable.$inferSelect) {
  return {
    id: row.id,
    originalName: row.originalName,
    mimeType: row.mimeType,
    size: row.size,
    category: row.category,
    subcategory: row.subcategory,
    documentDate: row.documentDate,
    description: row.description,
    uploadedAt: row.createdAt.toISOString(),
  };
}

router.get("/archive", async (req, res) => {
  if (!requireUser(req, res)) return;
  const rows = await db
    .select()
    .from(archiveDocumentsTable)
    .orderBy(desc(archiveDocumentsTable.createdAt));
  const documents = rows.map(toDocument);
  const groups = new Map<string, Map<string, typeof documents>>();
  for (const document of documents) {
    if (!groups.has(document.category)) groups.set(document.category, new Map());
    const subgroups = groups.get(document.category)!;
    if (!subgroups.has(document.subcategory)) subgroups.set(document.subcategory, []);
    subgroups.get(document.subcategory)!.push(document);
  }
  const categories = [...groups].map(([name, subgroups]) => {
    const subcategories = [...subgroups].map(([subName, items]) => ({
      name: subName,
      count: items.length,
      documents: items,
    }));
    return {
      name,
      count: subcategories.reduce((sum, item) => sum + item.count, 0),
      subcategories,
    };
  });
  res.json(
    ListArchiveResponse.parse({
      categories,
      documents,
      canRetire: getArchiveManagerEmails().has(
        req.user?.email?.trim().toLowerCase() ?? "",
      ),
    }),
  );
});

router.post("/archive/documents", async (req, res) => {
  if (!requireUser(req, res)) return;
  const parsed = CreateArchiveDocumentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid document metadata" });
    return;
  }
  const input = parsed.data;
  const extension = input.originalName.split(".").pop()?.toLowerCase() ?? "";
  if (
    !allowedExtensions.has(extension) ||
    input.size > maxFileSize ||
    !input.objectPath.startsWith("/objects/uploads/")
  ) {
    res.status(400).json({ error: "Unsupported document or invalid storage path" });
    return;
  }
  try {
    await storage.getObjectEntityFile(input.objectPath);
  const [row] = await db
    .select()
    .from(archiveDocumentsTable)
    .where(eq(archiveDocumentsTable.id, id));

    const [deleted] = await db
      .delete(archiveDocumentsTable)
      .where(eq(archiveDocumentsTable.id, id))
      .returning({ id: archiveDocumentsTable.id });
    res.status(201).json(CreateArchiveDocumentResponse.parse(toDocument(row)));
  } catch (error) {
    req.log.error({ err: error }, "Unable to save archive document");
    res.status(500).json({ error: "Unable to save document" });
  }
});

router.get("/archive/documents/:id", async (req, res) => {
  if (!requireUser(req, res)) return;
  const id = parsedParams.data.id;
  const [row] = await db
    .select()
    .from(archiveDocumentsTable)
    .where(eq(archiveDocumentsTable.id, id));

    const [deleted] = await db
      .delete(archiveDocumentsTable)
      .where(eq(archiveDocumentsTable.id, id))
      .returning({ id: archiveDocumentsTable.id });
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  res.json(GetArchiveDocumentResponse.parse(toDocument(row)));
});

async function serveContent(req: Request, res: Response, download: boolean): Promise<void> {
  if (!requireUser(req, res)) return;
  const id = Number(req.params.id);
  const [row] = await db
    .select()
    .from(archiveDocumentsTable)
    .where(eq(archiveDocumentsTable.id, id));
  if (!row) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  try {
    const file = await storage.getObjectEntityFile(row.objectPath);
    const response = await storage.downloadObject(file, 0);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    const disposition = download || row.mimeType !== "application/pdf" ? "attachment" : "inline";
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename*=UTF-8''${encodeURIComponent(row.originalName)}`,
    );
    if (!response.body) {
      res.end();
      return;
    }
    Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    return;
  } catch (error) {
    if (error instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Stored file not found" });
      return;
    }
    throw error;
  }
}

  const parsedParams = RetireArchiveDocumentParams.safeParse(req.params);
export default router;
