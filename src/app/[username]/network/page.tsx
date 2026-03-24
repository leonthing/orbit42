import type { Metadata } from "next";
import { getContacts } from "./actions";
import type { Contact } from "./actions";
import ContactList from "./ContactList";

export const metadata: Metadata = { title: "Network" };

export default async function NetworkPage({
  params,
}: {
  params: { username: string };
}) {
  let contacts: Contact[];
  try {
    contacts = await getContacts();
  } catch {
    contacts = [];
  }

  return (
    <div className="space-y-6">
      <ContactList contacts={contacts} username={params.username} />
    </div>
  );
}
