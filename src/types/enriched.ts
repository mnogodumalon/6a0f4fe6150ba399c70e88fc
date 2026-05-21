import type { Budgetposten } from './app';

export type EnrichedBudgetposten = Budgetposten & {
  reiseName: string;
  kategorieName: string;
};
