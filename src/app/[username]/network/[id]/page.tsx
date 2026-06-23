import { notFound } from "next/navigation";
import { getContact, getLinkedMember } from "../actions";
import { isFollowing } from "@/lib/follows";
import ContactDetail from "./ContactDetail";

export default async function ContactDetailPage({
  params,
}: {
  params: { username: string; id: string };
}) {
  const contact = await getContact(params.id);
  if (!contact) notFound();

  const member = contact.linked_user_id
    ? await getLinkedMember(contact.linked_user_id)
    : null;
  const following = member ? await isFollowing(member.username) : false;

  return (
    <ContactDetail
      contact={contact}
      username={params.username}
      member={member}
      initialFollowing={following}
    />
  );
}
