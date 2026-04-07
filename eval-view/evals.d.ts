import type { Metrics, RunResult as HarnessRunResult } from '../harness/lib/metrics.ts';

export interface FullRunResult extends HarnessRunResult {
  taskName?: string;
  baseApp?: string;
  prompt?: string;
}

export interface EvalsReport {
  summary: Metrics['summary'];
  results: Record<string, FullRunResult[]>;
  stats: Metrics['testStats'];
  timestamp: string;
  runCount: number;
  agent: string;
  serving: string;
  model: string;
}

export interface LooseEvalsReport {
  summary?: Partial<Metrics['summary']>;
  results?: Record<string, (Partial<FullRunResult> & Record<string, any>)[]>;
  stats?: Partial<Metrics['testStats']>;
  timestamp?: string;
  runCount?: number;
  agent?: string;
  serving?: string;
  model?: string;
  [key: string]: any;
}
