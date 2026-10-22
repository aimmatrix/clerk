'use client';

import type { IncomingMessage, ItemStatus, SimScriptStep } from '@clerk/core';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  type Chip,
  type SimFailure,
  type SimItem,
  type StepResult,
  OFFLINE,
  processStep,
  recentContext,
  resetRemote,
  syncReview,
} from './pipeline';
import { loadSimScript } from './script-source';

export type SimStatus = 'idle' | 'playing' | 'paused' | 'finished';
export type SimSpeed = 1 | 2 | 4;
export type ReviewStep = 'approve' | 'post' | 'done' | 'reject';

export interface SimMessage {
  message: IncomingMessage;
  /** `null` while Clerk is still reading the message. */
  chips: Chip[] | null;
}

interface State {
  status: SimStatus;
  cursor: number;
  messages: SimMessage[];
  items: SimItem[];
  failures: SimFailure[];
  noise: number;
  typing: string | null;
  /** Bumped on every insert; drives the "Live" pulse. */
  pulse: number;
  degraded: boolean;
}

type Action =
  | { type: 'reset' }
  | { type: 'restart' }
  | { type: 'status'; status: SimStatus }
  | { type: 'typing'; author: string | null }
  | { type: 'message'; message: IncomingMessage }
  | { type: 'result'; externalId: string; result: StepResult }
  | { type: 'advance' }
  | { type: 'review'; id: string; step: ReviewStep };

const initial: State = {
  status: 'idle',
  cursor: 0,
  messages: [],
  items: [],
  failures: [],
  noise: 0,
  typing: null,
  pulse: 0,
  degraded: false,
};

const NEXT_STATUS: Record<ReviewStep, ItemStatus> = {
  approve: 'approved',
  post: 'posted',
  done: 'done',
  reject: 'rejected',
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'reset':
      return initial;
    case 'restart':
      return { ...initial, status: 'playing' };
    case 'status':
      return { ...state, status: action.status, typing: action.status === 'playing' ? state.typing : null };
    case 'typing':
      return { ...state, typing: action.author };
    case 'advance':
      return { ...state, cursor: state.cursor + 1 };
    case 'message':
      return {
        ...state,
        typing: null,
        messages: [...state.messages, { message: action.message, chips: null }],
      };
    case 'result': {
      const { result, externalId } = action;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.message.externalId === externalId ? { ...m, chips: result.chips } : m,
        ),
        items: [...state.items, ...result.items],
        failures: [...state.failures, ...result.failures],
        noise: state.noise + result.noise,
        pulse: state.pulse + 1,
        degraded: state.degraded || result.degraded,
      };
    }
    case 'review': {
      const status = NEXT_STATUS[action.step];
      const updatedAt = new Date().toISOString();
      return {
        ...state,
        items: state.items.map((i) => (i.id === action.id ? { ...i, status, updatedAt } : i)),
        pulse: state.pulse + 1,
      };
    }
    default:
      return state;
  }
}

/** Heads-up shown before the next message lands, so the chat feels alive. */
const TYPING_LEAD_MS = 700;

export function useSimulator() {
  const [state, dispatch] = useReducer(reducer, initial);
  const [script, setScript] = useState<SimScriptStep[] | null>(null);
  const [speed, setSpeed] = useState<SimSpeed>(1);
  const [loadError, setLoadError] = useState(false);

  const runRef = useRef(0);
  const historyRef = useRef<IncomingMessage[]>([]);
  const itemsRef = useRef<SimItem[]>([]);
  itemsRef.current = state.items;

  useEffect(() => {
    let cancelled = false;
    loadSimScript()
      .then((steps) => !cancelled && setScript(steps))
      .catch(() => !cancelled && setLoadError(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const deliver = useCallback(async (step: SimScriptStep) => {
    const runId = runRef.current;
    const context = recentContext(step.message, historyRef.current);
    historyRef.current.push(step.message);
    dispatch({ type: 'message', message: step.message });
    const result = await processStep(step, context);
    if (runRef.current !== runId) return; // reset while in flight
    dispatch({ type: 'result', externalId: step.message.externalId, result });
  }, []);

  // The player: one timer pair per step, re-armed whenever status, cursor or speed changes.
  useEffect(() => {
    if (state.status !== 'playing' || !script) return;
    const step = script[state.cursor];
    if (!step) return;
    const wait = Math.max(0, step.delayMs / speed);
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (wait > TYPING_LEAD_MS * 1.5) {
      timers.push(setTimeout(() => dispatch({ type: 'typing', author: step.message.authorName }), wait - TYPING_LEAD_MS));
    }
    timers.push(
      setTimeout(() => {
        void deliver(step);
        dispatch({ type: 'advance' });
      }, wait),
    );
    return () => timers.forEach(clearTimeout);
  }, [state.status, state.cursor, speed, script, deliver]);

  // Playback is complete only after the last extraction (or cache fallback) has landed.
  useEffect(() => {
    if (state.status === 'playing' && script && state.cursor >= script.length &&
        state.messages.every((message) => message.chips !== null)) {
      dispatch({ type: 'status', status: 'finished' });
    }
  }, [state.status, state.cursor, state.messages, script]);

  const hardReset = useCallback(() => {
    runRef.current += 1;
    historyRef.current = [];
    resetRemote();
  }, []);

  const play = useCallback(() => {
    if (state.status === 'finished') {
      hardReset();
      dispatch({ type: 'restart' });
    } else {
      dispatch({ type: 'status', status: 'playing' });
    }
  }, [state.status, hardReset]);

  const pause = useCallback(() => dispatch({ type: 'status', status: 'paused' }), []);

  const reset = useCallback(() => {
    hardReset();
    dispatch({ type: 'reset' });
  }, [hardReset]);

  const review = useCallback((id: string, step: ReviewStep) => {
    const item = itemsRef.current.find((i) => i.id === id);
    if (!item) return;
    dispatch({ type: 'review', id, step });
    syncReview(item, step);
  }, []);

  const stats = useMemo(() => {
    const captured = state.items.length;
    const pending = state.items.filter((i) => i.status === 'pending').length;
    const approved = state.items.filter((i) => i.status === 'approved' || i.status === 'posted' || i.status === 'done').length;
    return {
      captured,
      pending,
      failures: state.failures.length,
      // PRD: hours saved = approved × 4 min ÷ 60.
      hoursSaved: (approved * 4) / 60,
    };
  }, [state.items, state.failures]);

  return {
    state,
    stats,
    speed,
    setSpeed,
    total: script?.length ?? 0,
    ready: script !== null,
    loadError,
    offline: OFFLINE,
    play,
    pause,
    reset,
    review,
  };
}
