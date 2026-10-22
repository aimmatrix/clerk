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
  const tone = offline || degraded ? 'text-warning' : 'text-muted-foreground';
  return (
    <span className={`rounded-full border border-border px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.05em] ${tone}`}>
      {text}
    </span>
  );
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
    <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-5 px-4 py-8 sm:px-8 lg:min-h-[calc(100dvh-4rem)]">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div>
            <h1 className="page-heading">Simulator</h1>
            <p className="mt-1 text-sm text-muted-foreground">Watch a busy channel become a ranked queue. No Discord needed.</p>
          </div>
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
        <p role="alert" className="rounded-lg border border-urgent/30 bg-surface px-3 py-2 text-sm text-urgent">
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

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:h-[640px]">
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
