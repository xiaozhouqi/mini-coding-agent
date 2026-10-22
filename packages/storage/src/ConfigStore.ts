import type { AppConfig } from '@minimal-agent/shared-types';
import type { DbConnection } from './db/connection';

const DEFAULT_CONFIG: AppConfig = {
  apiKey: '',
  model: 'deepseek-v4-pro',
  tokenBudget: 100000,
};

interface ConfigRow {
  api_key: string | null;
  model: string;
  token_budget: number;
}

// TEACHING: The config table is a singleton (always id = 1). An upsert
// (INSERT ... ON CONFLICT DO UPDATE) keeps it to a single row.
export class ConfigStore {
  constructor(private readonly db: DbConnection) {}

  get(): AppConfig {
    const row = this.db.prepare(`SELECT api_key, model, token_budget FROM config WHERE id = 1`).get() as
      | ConfigRow
      | undefined;
    if (!row) {
      this.set(DEFAULT_CONFIG);
      return { ...DEFAULT_CONFIG };
    }
    return { apiKey: row.api_key ?? '', model: row.model, tokenBudget: row.token_budget };
  }

  set(config: AppConfig): void {
    this.db
      .prepare(
        `INSERT INTO config (id, api_key, model, token_budget)
         VALUES (1, @apiKey, @model, @tokenBudget)
         ON CONFLICT(id) DO UPDATE SET api_key = excluded.api_key, model = excluded.model, token_budget = excluded.token_budget`,
      )
      .run({ apiKey: config.apiKey, model: config.model, tokenBudget: config.tokenBudget });
  }

  update(partial: Partial<AppConfig>): AppConfig {
    const next = { ...this.get(), ...partial };
    this.set(next);
    return next;
  }
}
