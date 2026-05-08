import fs from "node:fs/promises";
import type { Journal } from "./types";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getDB, insertDB, saveDB } from "./db";

const __dirname = dirname(fileURLToPath(import.meta.url));

const getFileContent = async (filename: string) => {
  const filePath = join(__dirname, "content", filename);
  const content = await fs.readFile(filePath, { encoding: "utf-8" });
  return content;
};

const writeToFile = async (journal: Journal & { content: string }) => {
  await fs.writeFile(
    `./src/content/${journal.filename}`,
    `----------------------------------
# ${journal.title}
----------------------------------

${journal.content}
`,
  );
};

const deleteFile = async (filename: string) => {
  const filePath = join(__dirname, "content", filename);
  await fs.unlink(filePath);
  return true;
};

export const createJournal = async (title: string, content: string) => {
  const db = await getDB();
  const journals = db.journals;
  const id = ++journals.length;
  const filename = `${id} - ${title}.md`;
  const data: Journal = {
    id,
    title: title,
    filename,
  };

  await insertDB(data);
  await writeToFile({ ...data, content });

  return data;
};

export const getAllJournals = async () => {
  const db = await getDB();
  const journals = db.journals;
  return journals;
};

export const getJournal = async (id: string) => {
  const db = await getDB();
  const journal = db.journals.find((journal, idx) => idx + 1 === +id);
  return journal;
};

export const getJournalContent = async (id: string) => {
  const journal = await getJournal(id);
  if (!journal) {
    throw new Error("Journal not found");
  }
  const content = await getFileContent(journal.filename);
  return content;
};

export const deleteJournal = async (id: string) => {
  const db = await getDB();
  const journal = await getJournal(id);
  if (journal) {
    const journals = db.journals.filter((journal) => journal.id !== +id);
    await deleteFile(journal.filename);
    await saveDB({ journals });
    return true;
  }
  return false;
};

export const updateJournalContent = async (
  id: string,
  newContent: string,
  options: { overwrite: boolean } = { overwrite: false },
) => {
  const journal = await getJournal(id);
  const content = await getJournalContent(id);
  if (journal) {
    switch (options.overwrite) {
      case true:
        await writeToFile({ ...journal, content: newContent });
        break;
      default:
        await writeToFile({
          ...journal,
          content: content.concat(`\n ${newContent}`),
        });
        break;
    }
  }

  return journal;
};
