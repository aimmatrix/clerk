import type { Item } from '@clerk/core';
import type { ConnectionStatus } from '@/lib/realtime';

/** What the board needs from a data source: the real `useItems` result, or the demo mock. */
export interface BoardItemsResult {
  items: Item[];
  loading: boolean;
  error: string | null;
  /** Realtime connection state. Undefined for sources that have none (the mock). */
  status?: ConnectionStatus;
  /** Bumps on every row that newly appears; drives the Live pulse. Undefined → the board counts inserts itself. */
  insertCount?: number;
}
