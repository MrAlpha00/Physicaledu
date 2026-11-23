import { readFileSync, writeFileSync } from "node:fs";
const path = "src/types/database.ts";
let source = readFileSync(path, "utf8");
const needle = "      phase5_finalize_timeout: {";
const addition = "      phase6_admin_search: { Args: { p_query: string }; Returns: Json };\n";
if (!source.includes("phase6_admin_search")) {
  if (!source.includes(needle)) throw new Error("Insertion anchor not found");
  source = source.replace(needle, addition + needle);
  writeFileSync(path, source);
}
console.log("phase6_admin_search type present:", source.includes("phase6_admin_search"));
