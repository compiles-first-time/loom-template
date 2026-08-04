import DataBrowser from "@/components/DataBrowser";
import { loadGameData } from "@/lib/game";

export default function DataPage() {
  const { data } = loadGameData();
  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <h1 style={{ margin: "0.5rem 0", fontSize: "1.5rem" }}>Game data</h1>
      <DataBrowser data={data} />
    </div>
  );
}
