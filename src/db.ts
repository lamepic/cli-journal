import fs from "fs/promises";
import type { DB, Journal } from "./types";

const DB_PATH = new URL("./db.json", import.meta.url).pathname;

export const saveDB = async (db: DB) => {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2));
  return db;
};

export const getDB = async (): Promise<DB> => {
  const db = await fs.readFile(DB_PATH, { encoding: "utf-8" });
  return JSON.parse(db);
};

export const insertDB = async (data: Journal) => {
  const db = await getDB();
  db.journals.push(data);
  await saveDB(db);
  return data;
};
