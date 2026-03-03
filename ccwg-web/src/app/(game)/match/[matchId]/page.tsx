import MatchPageClient from './MatchPageClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function MatchPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const { matchId } = await params;
  return <MatchPageClient matchId={matchId} />;
}
