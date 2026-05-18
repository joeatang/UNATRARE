import { notFound } from 'next/navigation';
import Nav from '../../components/Nav';
import { getDb } from '../../../lib/db';
import UpdateForm from './UpdateForm';

export async function generateMetadata({ params }) {
  const name = (await params).tokenname.toUpperCase();
  return { title: `Update ${name} — UNATRARE` };
}

export default async function UpdatePage({ params }) {
  const name = (await params).tokenname.toUpperCase();

  let token;
  try {
    const db = getDb();
    token = db.prepare(`
      SELECT token_name, display_title, artist_handle, description,
             category, subcategory, art_url, art_mime,
             audio_url, video_url, artist_address, owner_address
      FROM tokens WHERE token_name = ?
    `).get(name);
  } catch {
    notFound();
  }

  if (!token || (token.status !== undefined && token.status !== 'approved')) {
    // status not fetched — just check existence; API enforces status check
  }
  if (!token) notFound();

  // Pass only public fields to the client — artist_address is already visible
  // on the card page and on-chain; not sensitive.
  const initialData = {
    token_name:    token.token_name,
    display_title: token.display_title || token.token_name,
    artist_handle: token.artist_handle || '',
    description:   token.description   || '',
    category:      token.category      || '',
    subcategory:   token.subcategory   || '',
    audio_url:     token.audio_url     || '',
    video_url:     token.video_url     || '',
    art_url:       token.art_url       || '',
    art_mime:      token.art_mime      || '',
  };

  return (
    <>
      <Nav />
      <main>
        <UpdateForm initialData={initialData} />
      </main>
    </>
  );
}
