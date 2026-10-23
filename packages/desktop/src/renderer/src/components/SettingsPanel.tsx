import { useEffect, useState } from 'react';

// Configuration view: model, token budget, API key (write-only — the renderer
// never reads the stored key back), and a workspace folder picker.
interface SettingsPanelProps {
  workspace: string | null;
  onWorkspacePicked: (path: string) => void;
  onClose: () => void;
  onSaved: () => void;
}

export function SettingsPanel({ workspace, onWorkspacePicked, onClose, onSaved }: SettingsPanelProps) {
  const [model, setModel] = useState('deepseek-v4-pro');
  const [tokenBudget, setTokenBudget] = useState(100000);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    void window.api.configGet().then((c) => {
      setModel(c.model);
      setTokenBudget(c.tokenBudget);
      setHasApiKey(c.hasApiKey);
    });
  }, []);

  const pickWorkspace = async () => {
    const path = await window.api.workspacePick();
    if (path) onWorkspacePicked(path);
  };

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      await window.api.configSet({ apiKey, model, tokenBudget });
      setApiKey('');
      setHasApiKey(true);
      setMessage('Saved.');
      onSaved();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="settings-overlay">
      <div className="settings-panel">
        <h2>Settings</h2>
        <label className="field">
          <span>API key {hasApiKey ? '(stored)' : ''}</span>
          <input
            type="password"
            value={apiKey}
            placeholder={hasApiKey ? 'leave blank to keep current key' : 'sk-…'}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Model</span>
          <input value={model} onChange={(e) => setModel(e.target.value)} />
        </label>
        <label className="field">
          <span>Token budget</span>
          <input
            type="number"
            value={tokenBudget}
            onChange={(e) => setTokenBudget(Number(e.target.value))}
          />
        </label>
        <div className="field">
          <span>Workspace</span>
          <div className="workspace-row">
            <span className="workspace-path">{workspace ?? '(not set — pick when creating a session)'}</span>
            <button className="btn" onClick={() => void pickWorkspace()}>Browse…</button>
          </div>
        </div>
        <div className="settings-actions">
          <button className="btn btn-primary" onClick={() => void save()} disabled={saving}>Save</button>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        {message && <div className="settings-message">{message}</div>}
      </div>
    </div>
  );
}
