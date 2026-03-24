import { notFound } from "next/navigation";
import { getNote } from "../actions";
import NoteEditor from "./NoteEditor";

export default async function NoteDetailPage({
  params,
}: {
  params: { username: string; id: string };
}) {
  let note;
  try {
    note = await getNote(params.id);
  } catch {
    notFound();
  }

  return <NoteEditor note={note} />;
}
