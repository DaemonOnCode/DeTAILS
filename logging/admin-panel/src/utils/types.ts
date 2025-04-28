export interface DatabaseRow {
  id: number;
  created_at: string;
  state: string;
  context: string;
}

export interface Context {
  function: string;
  run?: string;
  [key: string]: any;
}

export interface CodingResult {
  id: string;
  model: string;
  quote: string;
  code: string;
  explanation: string;
  post_id: string;
  chat_history: any | null;
  is_marked: boolean | null;
  range_marker: any | null;
  response_type: "Human" | "LLM";
}
