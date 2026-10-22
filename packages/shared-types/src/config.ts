export interface AgentConfig {
  apiKey: string;
  model: string;
  tokenBudget: number;
  systemPrompt: string;
}

// Persisted app settings (config table). AgentConfig adds runtime-only fields
// (e.g. systemPrompt) on top of this.
export interface AppConfig {
  apiKey: string;
  model: string;
  tokenBudget: number;
}
