import { redirect } from 'next/navigation';

export default async function SupporterRedirectPage({ params }) {
  const wallet = decodeURIComponent((await params).wallet);
  redirect(`/torchbearer/${wallet}`);
}