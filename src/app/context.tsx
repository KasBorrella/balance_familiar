import { createContext, useContext } from "react";
import type { Data, Row, TableName } from "@/domain/models";
export type EditorKind =
  | "category"
  | "expense"
  | "income"
  | "budget"
  | "allocation"
  | "transaction"
  | "fund"
  | "goal"
  | "entry";
export type EditorRequest = {
  kind: EditorKind;
  row?: Row<TableName>;
  defaults?: Record<string, string>;
};
export type FinanceContextValue = {
  data: Data;
  period: string;
  open: (request: EditorRequest) => void;
  notify: (message: string, error?: boolean) => void;
  remove: (table: TableName, id: string, name: string) => void;
};
export const FinanceContext = createContext<FinanceContextValue | null>(null);
export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) throw new Error("Falta el contexto financiero");
  return ctx;
}
