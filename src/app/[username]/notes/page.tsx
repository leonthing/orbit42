import type { Metadata } from "next";
import { getNotes } from "./actions";
import NoteList from "./NoteList";

export const metadata: Metadata = { title: "Notes" };

export default async function NotesPage() {
  const notes = await getNotes();

  return <NoteList initialNotes={notes} />;
}
