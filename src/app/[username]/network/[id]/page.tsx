import { notFound } from "next/navigation";
import { getContact } from "../actions";
import ContactDetail from "./ContactDetail";

export default async function ContactDetailPage({
  params,
}: {
  params: { username: string; id: string };
}) {
  const contact = await getContact(params.id);
  if (!contact) notFound();

  return <ContactDetail contact={contact} username={params.username} />;
}
