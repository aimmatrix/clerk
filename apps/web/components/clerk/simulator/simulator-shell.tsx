'use client';

import { ChatPane } from './chat-pane';
import { Controls } from './controls';
import { FlightProvider, useFlightLauncher } from './flight-layer';
import { SimBoard } from './sim-board';
import { StatsBar } from './stats-bar';
import { useSimulator } from './use-simulator';

function ModeBadge({ offline, degraded }: { offline: boolean; degraded: boolean }) {
  const text = offline
    ? 'Offline mode · cached extractions'
    : degraded
      ? 'API unreachable · using cached extractions'
      : 'Live pipeline · /api/ingest';
  const tone = offline || degraded ? 'bg-request/15 text-request' : 'bg-accent/10 text-accent';
  return <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${tone}`}>{text}</span>;
}

function SimulatorInner() {
  const sim = useSimulator();
  const flights = useFlightLauncher();
  const { state, stats } = sim;

  const handleReset = () => {
    flights?.clear();
    sim.reset();
  };
  const handlePlay = () => {
    if (state.status === 'finished') flights?.clear();
    sim.play();
  };

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 p-3 lg:h-[calc(100dvh-4rem)] lg:p-4">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-display text-xl font-semibold tracking-tight">Simulator</h1>
          <ModeBadge offline={sim.offline} degraded={state.degraded} />
        </div>
        <Controls
          status={state.status}
          speed={sim.speed}
          ready={sim.ready}
          cursor={state.cursor}
          total={sim.total}
          onPlay={handlePlay}
          onPause={sim.pause}
          onReset={handleReset}
          onSpeed={sim.setSpeed}
        />
      </header>

      {sim.loadError && (
        <p role="alert" className="rounded-md border border-urgent/30 bg-urgent/10 px-3 py-2 text-sm text-urgent">
          Couldn&apos;t load the demo script. Check demo/seed/london-meetup.json.
        </p>
      )}

      <StatsBar
        captured={stats.captured}
        pending={stats.pending}
        hoursSaved={stats.hoursSaved}
        failures={stats.failures}
        ignored={state.noise}
        pulse={state.pulse}
        playing={state.status === 'playing'}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="flex h-[60dvh] min-h-0 flex-col lg:h-auto [&>section]:min-h-0 [&>section]:flex-1">
          <ChatPane messages={state.messages} typing={state.typing} status={state.status} />
        </div>
        <div className="flex min-h-0 flex-col [&>section]:min-h-0 [&>section]:flex-1">
          <SimBoard items={state.items} failures={state.failures} onReview={sim.review} />
        </div>
      </div>
    </div>
  );
}

export function SimulatorShell() {
  return (
    <FlightProvider>
      <SimulatorInner />
    </FlightProvider>
  );
}
