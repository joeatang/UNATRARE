import Nav from '../components/Nav';
import WalletsClient from './WalletsClient';

export const metadata = {
  title: 'Get Started — UNATRARE',
  description: 'Set up your wallets for UNATRARE drops. XCP Wallet for Counterparty art. TAP Wallet for UNATPEPE and NAT.',
};

export default function WalletsPage() {
  return (
    <>
      <Nav />
      <WalletsClient />
    </>
  );
}
