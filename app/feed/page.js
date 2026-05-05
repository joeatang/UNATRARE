import { redirect } from 'next/navigation';

// Feed is now the homepage — redirect to /
export default function FeedPage() {
  redirect('/');
}
