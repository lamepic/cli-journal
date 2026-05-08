import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import readline from "node:readline";
import {
  createJournal,
  deleteJournal,
  getAllJournals,
  getJournalContent,
  searchJournals,
  updateJournalContent,
} from "./journal";
import { marked, type MarkedExtension } from "marked";
import { markedTerminal } from "marked-terminal";

const program = new Command();
marked.use(markedTerminal() as unknown as MarkedExtension);

function setupProgram() {
  const contentPath = new URL("./content", import.meta.url).pathname;
  fs.mkdir(contentPath, { recursive: true }, (err) => {
    if (err) throw new Error(err.name);
  });
  const dbPath = new URL("./db.json", import.meta.url).pathname;
  try {
    fs.writeFileSync(dbPath, JSON.stringify({ journals: [] }), { flag: "wx" });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err;
  }
}

const readStdin = (): Promise<string> =>
  new Promise((resolve, reject) => {
    let data = "";
    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data));
    process.stdin.on("error", reject);
  });

const confirm = (question: string): Promise<boolean> =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y");
    });
  });

const formatEntry = (j: { id: number; title: string; createdAt?: string }) =>
  `${j.id} - ${j.title}${j.createdAt ? ` (${j.createdAt.slice(0, 10)})` : ""}`;

program.name("journal").description("CLI Journal app").version("1.0.0");

program
  .command("add")
  .description("Add a new journal entry")
  .requiredOption("-t, --title <title>", "title of the journal")
  .option("-c, --content <content>", "content of the journal (or pipe via stdin)")
  .action(async (options: { title: string; content?: string }) => {
    try {
      const { title } = options;
      if (!title.trim()) {
        console.log(chalk.red("Title cannot be empty."));
        return;
      }
      let content = options.content;
      if (!content) {
        if (!process.stdin.isTTY) {
          content = await readStdin();
        } else {
          console.log(chalk.red("Provide content via -c or pipe it via stdin."));
          return;
        }
      }
      if (!content.trim()) {
        console.log(chalk.red("Content cannot be empty."));
        return;
      }
      await createJournal(title, content);
      console.log(chalk.green("Journal added!"));
    } catch (err) {
      console.log(chalk.red((err as Error).message));
    }
  });

program
  .command("list")
  .description("List all journals")
  .option("-n, --recent <n>", "show N most recently created entries")
  .action(async (options: { recent?: string }) => {
    try {
      let journals = await getAllJournals();
      if (options.recent) {
        const n = parseInt(options.recent, 10);
        journals = [...journals]
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, n);
      }
      if (journals.length === 0) {
        console.log(chalk.yellow("No journals yet."));
        return;
      }
      console.log(chalk.green(journals.map(formatEntry).join("\n")));
    } catch (err) {
      console.log(chalk.red((err as Error).message));
    }
  });

program
  .command("view")
  .requiredOption("--id <id>", "id of the journal")
  .description("View a journal entry")
  .action(async (options: { id: string }) => {
    try {
      const content = await getJournalContent(options.id);
      console.log(marked.parse(content));
    } catch (err) {
      console.log(chalk.red((err as Error).message));
    }
  });

program
  .command("edit")
  .requiredOption("--id <id>", "id of the journal")
  .requiredOption("-c, --content <content>", "content to add")
  .option("--overwrite", "overwrite existing content instead of appending")
  .description("Edit a journal entry (appends by default)")
  .action(
    async (options: { id: string; content: string; overwrite: boolean }) => {
      try {
        const { id, content, overwrite } = options;
        await updateJournalContent(id, content, { overwrite });
        console.log(
          chalk.green(overwrite ? "Journal overwritten." : "Journal updated (appended)."),
        );
      } catch (err) {
        console.log(chalk.red((err as Error).message));
      }
    },
  );

program
  .command("delete")
  .requiredOption("--id <id>", "id of the journal")
  .description("Delete a journal entry")
  .action(async (options: { id: string }) => {
    try {
      const journals = await getAllJournals();
      const journal = journals.find((j) => j.id === +options.id);
      if (!journal) {
        console.log(chalk.red(`Journal with id ${options.id} not found.`));
        return;
      }
      const ok = await confirm(
        chalk.yellow(`Delete "${journal.title}"? (y/N) `),
      );
      if (!ok) {
        console.log("Cancelled.");
        return;
      }
      await deleteJournal(options.id);
      console.log(chalk.red(`"${journal.title}" deleted.`));
    } catch (err) {
      console.log(chalk.red((err as Error).message));
    }
  });

program
  .command("search")
  .description("Search journals by title or content")
  .requiredOption("-q, --query <query>", "search query")
  .action(async (options: { query: string }) => {
    try {
      const results = await searchJournals(options.query);
      if (results.length === 0) {
        console.log(chalk.yellow("No journals matched your query."));
        return;
      }
      console.log(chalk.green(results.map(formatEntry).join("\n")));
    } catch (err) {
      console.log(chalk.red((err as Error).message));
    }
  });

setupProgram();
program.parse();
