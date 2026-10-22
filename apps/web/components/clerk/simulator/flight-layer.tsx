'use client';

import { motion } from 'framer-motion';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export interface FlightRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FlightRequest {
  id: string;
  from: FlightRect;
  to: FlightRect;
  label: string;
  /** CSS colour, e.g. `rgb(var(--task))`. */
  colour: string;
  /** Called when the ghost lands so the real card can appear in its place. */
  onLand: () => void;
}

interface FlightApi {
  /** Returns false if this item has already flown (so remounts in another column don't re-fly). */
  launch: (flight: FlightRequest) => boolean;
  clear: () => void;
}

const FlightContext = createContext<FlightApi | null>(null);

export function useFlightLauncher(): FlightApi | null {
  return useContext(FlightContext);
}

/** The brief's "fly-in": a ghost card leaves the source message and springs to its column. */
export function FlightProvider({ children }: { children: ReactNode }) {
  const [flights, setFlights] = useState<FlightRequest[]>([]);
  const seen = useRef(new Set<string>());
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const launch = useCallback((flight: FlightRequest) => {
    if (seen.current.has(flight.id)) return false;
    seen.current.add(flight.id);
    setFlights((f) => [...f, flight]);
    return true;
  }, []);

  const clear = useCallback(() => {
    seen.current.clear();
    setFlights([]);
  }, []);

  const land = useCallback((flight: FlightRequest) => {
    flight.onLand();
    setFlights((f) => f.filter((x) => x !== flight));
  }, []);

  const api = useMemo(() => ({ launch, clear }), [launch, clear]);

  return (
    <FlightContext.Provider value={api}>
      {children}
      {mounted &&
        createPortal(
          <div aria-hidden className="pointer-events-none fixed inset-0 z-[60]">
            {flights.map((flight) => (
              <motion.div
                key={flight.id}
                className="absolute overflow-hidden rounded-lg border bg-[rgb(var(--surface-solid))] px-3 py-2 text-sm font-medium shadow-glass"
                style={{ borderColor: flight.colour }}
                initial={{ ...flight.from, opacity: 0.95 }}
                animate={{ ...flight.to, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 260, damping: 24 }}
                onAnimationComplete={() => land(flight)}
              >
                <span className="line-clamp-2">{flight.label}</span>
              </motion.div>
            ))}
          </div>,
          document.body,
        )}
    </FlightContext.Provider>
  );
}
