import Editor from "@/components/Editor";
import { loadGameData } from "@/lib/game";

export default function EditorPage() {
  const { data } = loadGameData();
  return <Editor data={data} />;
}
