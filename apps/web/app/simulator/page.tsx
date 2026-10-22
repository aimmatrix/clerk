import type { Metadata } from 'next';
import { SimulatorShell } from '@/components/clerk/simulator';

export const metadata: Metadata = {
  title: 'Simulator — Clerk',
  description: 'Watch Clerk turn a simulated community chat into owned, prioritised tasks. No Discord needed.',
};

export default function SimulatorPage() {
  return <SimulatorShell />;
}
