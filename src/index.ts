// src/cli.ts
import { Command } from "commander";
import chalk from "chalk";
import fs from "node:fs";
import {
  createJournal,
  deleteJournal,
  getAllJournals,
  getJournalContent,
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
    fs.writeFileSync(dbPath, JSON.stringify({ journals: [] }), {
      flag: "wx",
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
      throw err;
    }
  }
}

program.name("CLI Journal").description("CLI Journal app").version("0.1.0");

program
  .command("add")
  .description("Add new Journal")
  .requiredOption("-t, --title <title>", "name of journal")
  .requiredOption("-c, --content <content>", "content of journal")
  .action(async (options: { content: string; title: string }) => {
    const { title, content } = options;
    await createJournal(title, content);
    console.log(chalk.green("New Journal add!"));
  });

program
  .command("list")
  .description("list all Journals")
  .action(async () => {
    const journal = await getAllJournals();
    const formatted = journal.reduce(
      (acc, curr, idx) => acc + `${idx + 1} -  ${curr}` + "\n",
      "",
    );
    console.log(chalk.green(formatted));
  });

program
  .command("view")
  .requiredOption("--id <id>", "id of journal")
  .description("view a Journal")
  .action(async (options: { id: string }) => {
    const content = await getJournalContent(options.id);
    console.log(marked.parse(content));
  });

program
  .command("delete")
  .requiredOption("--id <id>", "id of journal")
  .description("delete a Journal")
  .action(async (options: { id: string }) => {
    const deleted = await deleteJournal(options.id);
    if (deleted) console.log(chalk.red("Deleted Successfully!"));
  });

program
  .command("edit")
  .requiredOption("--id <id>", "journal id")
  .requiredOption("-c, --content <content>", "journal id")
  .option("--overwrite", "overwrite existing content")
  .description("view a Journal")
  .action(
    async (options: {
      id: string;
      content: string;
      append: boolean;
      overwrite: boolean;
    }) => {
      const { id, content, overwrite } = options;
      await updateJournalContent(id, content, { overwrite });
    },
  );

setupProgram();
program.parse();
