import { redirect } from 'next/navigation';

export default function ProfilePage({ searchParams }) {
  const address = typeof searchParams?.address === 'string' ? searchParams.address.trim() : '';
  const target = address ? `/studio/profile?address=${encodeURIComponent(address)}` : '/studio/profile';
  redirect(target);
}
