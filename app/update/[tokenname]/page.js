import { redirect } from 'next/navigation';

export async function generateMetadata({ params }) {
  const name = (await params).tokenname.toUpperCase();
  return { title: `Update ${name} — UNATRARE` };
}

export default async function UpdatePage({ params }) {
  const name = (await params).tokenname.toUpperCase();
  redirect(`/studio/update/${encodeURIComponent(name)}`);
}
