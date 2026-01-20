import { useState, useEffect } from 'react';
import { Key, Brain, CheckCircle, AlertTriangle, ChevronDown, Server, Globe } from 'lucide-react';
import { useSettingsStore, LLM_PROVIDERS, type LLMProvider } from '../../stores/settingsStore';

export function SettingsPage() {
  const {
    selectedProvider,
    selectedModel,
    apiKeys,
    useAIExtraction,
    customLlmBaseUrl,
    customLlmModelName,
    setSelectedProvider,
    setSelectedModel,
    setApiKey,
    setUseAIExtraction,
    setCustomLlmBaseUrl,
    setCustomLlmModelName,
  } = useSettingsStore();

  const [apiKeyInput, setApiKeyInput] = useState(apiKeys[selectedProvider] || '');
  const [baseUrlInput, setBaseUrlInput] = useState(customLlmBaseUrl);
  const [modelNameInput, setModelNameInput] = useState(customLlmModelName);

  // Update inputs when provider changes
  useEffect(() => {
    setApiKeyInput(apiKeys[selectedProvider] || '');
  }, [selectedProvider, apiKeys]);

  const handleProviderChange = (provider: LLMProvider) => {
    setSelectedProvider(provider);
    setApiKeyInput(apiKeys[provider] || '');
  };

  const saveApiKey = () => {
    setApiKey(selectedProvider, apiKeyInput);
  };

  const saveCustomConfig = () => {
    setCustomLlmBaseUrl(baseUrlInput);
    setCustomLlmModelName(modelNameInput);
    if (apiKeyInput) {
      setApiKey('custom', apiKeyInput);
    }
  };

  const activeApiKey = apiKeys[selectedProvider] || '';

  return (
    <div className="flex-1 overflow-auto">
      {/* Page Header */}
      <div className="bg-[var(--header-bg)] px-6 py-5">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-xl font-semibold text-white">Settings</h1>
          <p className="text-sm text-white/70 mt-0.5">
            Configure AI extraction and API keys
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <div className="max-w-3xl mx-auto space-y-6">
          {/* Extraction Mode */}
          <div className="p-5 bg-white border border-[var(--border)] rounded-xl shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Brain className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-semibold text-[var(--text)]">Extraction Mode</h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center bg-[var(--bg-tertiary)] rounded-lg p-1">
                <button
                  onClick={() => setUseAIExtraction(true)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    useAIExtraction
                      ? 'bg-[var(--accent)] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  <Brain className="w-4 h-4" />
                  AI Extraction
                </button>
                <button
                  onClick={() => setUseAIExtraction(false)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                    !useAIExtraction
                      ? 'bg-[var(--success)] text-white shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`}
                >
                  Quick Parse
                </button>
              </div>
            </div>
            <p className="text-sm text-[var(--text-dim)] mt-3">
              {useAIExtraction
                ? 'Uses AI for intelligent extraction (recommended for complex measures)'
                : 'Fast local parsing without AI (limited extraction quality)'}
            </p>
          </div>

          {/* LLM Provider Selection */}
          <div className="p-5 bg-white border border-[var(--border)] rounded-xl shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Brain className="w-5 h-5 text-[var(--accent)]" />
              <h3 className="font-semibold text-[var(--text)]">LLM Provider</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {LLM_PROVIDERS.map((provider) => (
                <button
                  key={provider.id}
                  onClick={() => handleProviderChange(provider.id)}
                  className={`p-4 rounded-lg border text-left transition-all ${
                    selectedProvider === provider.id
                      ? 'border-[var(--accent)] bg-[var(--accent-light)] shadow-sm'
                      : 'border-[var(--border)] hover:border-[var(--accent)] bg-white'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {provider.id === 'custom' ? (
                      <Server className="w-4 h-4 text-[var(--info)]" />
                    ) : (
                      <Brain className="w-4 h-4 text-[var(--accent)]" />
                    )}
                    <span className="font-medium text-sm text-[var(--text)]">{provider.name}</span>
                  </div>
                  <div className="text-xs text-[var(--text-dim)] mt-1 line-clamp-2">{provider.description}</div>
                  {apiKeys[provider.id] && (
                    <div className="flex items-center gap-1 text-xs text-[var(--success)] mt-2">
                      <CheckCircle className="w-3 h-3" />
                      Configured
                    </div>
                  )}
                </button>
              ))}
            </div>

            {/* Model Selection - only for non-custom providers */}
            {selectedProvider !== 'custom' && (
              <div>
                <label className="text-sm text-[var(--text-muted)] mb-2 block">Model</label>
                <div className="relative">
                  <select
                    value={selectedModel}
                    onChange={(e) => setSelectedModel(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] appearance-none cursor-pointer focus:outline-none focus:border-[var(--accent)]"
                  >
                    {LLM_PROVIDERS.find(p => p.id === selectedProvider)?.models.map((model) => (
                      <option key={model.id} value={model.id}>{model.name}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-dim)] pointer-events-none" />
                </div>
              </div>
            )}
          </div>

          {/* Custom LLM Configuration - only shown when custom is selected */}
          {selectedProvider === 'custom' && (
            <div className="p-5 bg-white border border-[var(--info)]/30 rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Server className="w-5 h-5 text-[var(--info)]" />
                <h3 className="font-semibold text-[var(--text)]">Custom LLM Configuration</h3>
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-4">
                Configure your self-hosted or custom LLM endpoint. Uses OpenAI-compatible API format.
              </p>

              <div className="space-y-4">
                {/* Base URL */}
                <div>
                  <label className="text-sm text-[var(--text-muted)] mb-2 block">
                    <Globe className="w-4 h-4 inline mr-1" />
                    API Base URL
                  </label>
                  <input
                    type="text"
                    value={baseUrlInput}
                    onChange={(e) => setBaseUrlInput(e.target.value)}
                    placeholder="http://localhost:11434/v1"
                    className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--info)]"
                  />
                  <p className="text-xs text-[var(--text-dim)] mt-1">
                    Common endpoints: Ollama (localhost:11434/v1), LM Studio (localhost:1234/v1), vLLM, LocalAI
                  </p>
                </div>

                {/* Model Name */}
                <div>
                  <label className="text-sm text-[var(--text-muted)] mb-2 block">Model Name</label>
                  <input
                    type="text"
                    value={modelNameInput}
                    onChange={(e) => setModelNameInput(e.target.value)}
                    placeholder="llama2, mistral, codellama, etc."
                    className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--info)]"
                  />
                </div>

                {/* API Key (optional for local) */}
                <div>
                  <label className="text-sm text-[var(--text-muted)] mb-2 block">
                    API Key <span className="text-[var(--text-dim)]">(optional for local servers)</span>
                  </label>
                  <input
                    type="password"
                    value={apiKeyInput}
                    onChange={(e) => setApiKeyInput(e.target.value)}
                    placeholder="Leave empty for local servers without auth"
                    className="w-full px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--info)]"
                  />
                </div>

                {/* Save Button */}
                <button
                  onClick={saveCustomConfig}
                  className="w-full px-5 py-2.5 bg-[var(--info)] text-white rounded-lg font-medium hover:opacity-90 transition-opacity shadow-sm"
                >
                  Save Custom Configuration
                </button>

                {customLlmBaseUrl && (
                  <p className="text-sm text-[var(--success)] flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    Custom LLM configured: {customLlmBaseUrl}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* API Key Configuration - only for non-custom providers */}
          {selectedProvider !== 'custom' && (
            <div className="p-5 bg-white border border-[var(--border)] rounded-xl shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Key className="w-5 h-5 text-[var(--accent)]" />
                <h3 className="font-semibold text-[var(--text)]">
                  {LLM_PROVIDERS.find(p => p.id === selectedProvider)?.name} API Key
                </h3>
              </div>
              <p className="text-sm text-[var(--text-muted)] mb-4">
                Enter your API key to enable AI-powered extraction. Your key is stored locally in your browser.
              </p>
              <div className="flex gap-3">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    selectedProvider === 'anthropic' ? 'sk-ant-api...' :
                    selectedProvider === 'openai' ? 'sk-...' :
                    'API key...'
                  }
                  className="flex-1 px-4 py-2.5 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg text-[var(--text)] placeholder-[var(--text-dim)] focus:outline-none focus:border-[var(--accent)]"
                />
                <button
                  onClick={saveApiKey}
                  className="px-5 py-2.5 bg-[var(--primary)] text-white rounded-lg font-medium hover:bg-[var(--primary-hover)] transition-colors shadow-sm"
                >
                  Save
                </button>
              </div>
              {activeApiKey && (
                <p className="text-sm text-[var(--success)] mt-3 flex items-center gap-1">
                  <CheckCircle className="w-4 h-4" />
                  API key configured and saved
                </p>
              )}
              {useAIExtraction && !activeApiKey && (
                <p className="text-sm text-[var(--warning)] mt-3 flex items-center gap-1">
                  <AlertTriangle className="w-4 h-4" />
                  API key required for AI extraction
                </p>
              )}
            </div>
          )}

          {/* Info Card */}
          <div className="p-4 bg-[var(--accent-light)] border border-[var(--accent)]/30 rounded-xl">
            <p className="text-sm text-[var(--accent)]">
              <strong>Privacy Note:</strong> API keys are stored locally in your browser and never sent to our servers.
              All AI extraction calls are made directly from your browser to the LLM provider.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
