export interface Journal {
  id: number;
  title: string;
  filename: string;
}

export interface DB {
  journals: Journal[];
}
