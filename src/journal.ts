import fs from "node:fs/promises";
import type { Journal } from "./types";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDB, insertDB, saveDB } from "./db";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sanitizeFilename = (name: string) =>
  name.replace(/[<>:"/\\|?*]/g, "").replace(/\s+/g, " ").trim();

const getFileContent = async (filename: string) => {
  const filePath = join(__dirname, "content", filename);
  const content = await fs.readFile(filePath, { encoding: "utf-8" });
  return content;
};

const writeToFile = async (journal: Journal & { content: string }) => {
  const filePath = join(__dirname, "content", journal.filename);
  await fs.writeFile(
    filePath,
    `----------------------------------\n# ${journal.title}\n----------------------------------\n\n${journal.content}\n`,
  );
};

const deleteFile = async (filename: string) => {
  const filePath = join(__dirname, "content", filename);
  await fs.unlink(filePath);
};

const extractBody = (rawContent: string) =>
  rawContent.split("\n").slice(4).join("\n").trimEnd();

export const createJournal = async (title: string, content: string) => {
  const db = await getDB();
  const journals = db.journals;
  const id = Math.max(0, ...journals.map((j) => j.id)) + 1;
  const filename = `${id} - ${sanitizeFilename(title)}.md`;
  const now = new Date().toISOString();
  const data: Journal = {
    id,
    title,
    filename,
    createdAt: now,
    updatedAt: now,
  };

  await insertDB(data);
  await writeToFile({ ...data, content });

  return data;
};

export const getAllJournals = async () => {
  const db = await getDB();
  return db.journals;
};

export const getJournal = async (id: string) => {
  const db = await getDB();
  return db.journals.find((j) => j.id === +id);
};

export const getJournalContent = async (id: string) => {
  const journal = await getJournal(id);
  if (!journal) throw new Error(`Journal with id ${id} not found`);
  return getFileContent(journal.filename);
};

export const deleteJournal = async (id: string) => {
  const db = await getDB();
  const journal = await getJournal(id);
  if (!journal) throw new Error(`Journal with id ${id} not found`);
  await deleteFile(journal.filename);
  await saveDB({ journals: db.journals.filter((j) => j.id !== +id) });
};

export const updateJournalContent = async (
  id: string,
  newContent: string,
  options: { overwrite: boolean } = { overwrite: false },
) => {
  const journal = await getJournal(id);
  if (!journal) throw new Error(`Journal with id ${id} not found`);

  let content: string;
  if (options.overwrite) {
    content = newContent;
  } else {
    const body = extractBody(await getJournalContent(id));
    content = body + "\n\n" + newContent;
  }

  await writeToFile({ ...journal, content });

  const db = await getDB();
  const idx = db.journals.findIndex((j) => j.id === +id);
  if (idx !== -1) {
    db.journals[idx]!.updatedAt = new Date().toISOString();
    await saveDB(db);
  }

  return journal;
};

export const searchJournals = async (query: string) => {
  const db = await getDB();
  const q = query.toLowerCase();
  const matched: Journal[] = [];
  for (const journal of db.journals) {
    if (journal.title.toLowerCase().includes(q)) {
      matched.push(journal);
      continue;
    }
    try {
      const content = await getFileContent(journal.filename);
      if (content.toLowerCase().includes(q)) matched.push(journal);
    } catch {
      // skip entries whose files are missing
    }
  }
  return matched;
};
