import { GameHeader } from '@/src/components/navigation/GameHeader';
import { MobileBottomNav } from '@/src/components/navigation/MobileBottomNav';
import { SanctionGate } from '@/src/components/system/SanctionGate';
import { GameBootGate } from '@/src/components/system/GameBootGate';
import { PresenceBeacon } from '@/src/components/system/PresenceBeacon';
import { ChallengeInboxPopup } from '@/src/components/system/ChallengeInboxPopup';

export default function GameLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <GameBootGate>
      <SanctionGate>
        {/* Full-height game shell — no scroll on outer container */}
        <div className="flex flex-col min-h-screen bg-theme-primary">
          <PresenceBeacon />
          <ChallengeInboxPopup />
          <GameHeader />
          {/* Main content grows to fill viewport; pad bottom on mobile for bottom nav */}
          <main className="flex-1 relative overflow-y-auto pb-16 lg:pb-0">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </SanctionGate>
    </GameBootGate>
  );
}


