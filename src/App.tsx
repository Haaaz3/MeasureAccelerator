import { useEffect, useState } from 'react';
import { useMeasureStore } from './stores/measureStore';
import { useComponentLibraryStore } from './stores/componentLibraryStore';
import { Sidebar } from './components/layout/Sidebar';
import { MeasureLibrary } from './components/measure/MeasureLibrary';
import { UMSEditor } from './components/measure/UMSEditor';
import { ValidationTraceViewer } from './components/validation/ValidationTraceViewer';
import { CodeGeneration } from './components/measure/CodeGeneration';
import { ValueSetManager } from './components/valueset/ValueSetManager';
import { SettingsPage } from './components/settings/SettingsPage';
import { LibraryBrowser } from './components/library/LibraryBrowser';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import { AlertTriangle, RefreshCw } from 'lucide-react';

function App() {
  const { activeTab, loadFromApi: loadMeasures, isLoadingFromApi: measuresLoading, apiError: measuresError } = useMeasureStore();
  const { loadFromApi: loadComponents, isLoadingFromApi: componentsLoading, apiError: componentsError } = useComponentLibraryStore();
  const [isRetrying, setIsRetrying] = useState(false);

  // Load measures and components from backend API on mount
  useEffect(() => {
    loadMeasures();
    loadComponents();
  }, [loadMeasures, loadComponents]);

  const isLoading = measuresLoading || componentsLoading;
  const hasError = !isLoading && (measuresError || componentsError);
  const errorMessage = measuresError || componentsError;

  const handleRetry = async () => {
    setIsRetrying(true);
    await Promise.all([loadMeasures(), loadComponents()]);
    setIsRetrying(false);
  };

  return (
    <div className="h-screen flex">
      <Sidebar />
      {isLoading && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="animate-spin h-5 w-5 border-2 border-emerald-500 border-t-transparent rounded-full"></div>
              <span className="text-gray-700 dark:text-gray-300">Loading from backend...</span>
            </div>
          </div>
        </div>
      )}
      {hasError && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl max-w-md mx-4">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                  Unable to Connect to Backend
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {errorMessage || 'The backend server is not responding. Please ensure the backend is running on port 8080.'}
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-md text-sm font-medium transition-colors"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRetrying ? 'animate-spin' : ''}`} />
                    {isRetrying ? 'Retrying...' : 'Retry Connection'}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-4">
                  Run: <code className="bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">cd backend && ./mvnw spring-boot:run</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
      <main className="flex-1 flex flex-col overflow-hidden">
        {activeTab === 'library' && <MeasureLibrary />}
        {activeTab === 'valuesets' && (
          <ErrorBoundary fallbackName="Value Set Manager">
            <ValueSetManager />
          </ErrorBoundary>
        )}
        {activeTab === 'editor' && (
          <ErrorBoundary fallbackName="Measure Editor">
            <UMSEditor />
          </ErrorBoundary>
        )}
        {activeTab === 'validation' && (
          <ErrorBoundary fallbackName="Validation Viewer">
            <ValidationTraceViewer />
          </ErrorBoundary>
        )}
        {activeTab === 'codegen' && (
          <ErrorBoundary fallbackName="Code Generation">
            <CodeGeneration />
          </ErrorBoundary>
        )}
        {activeTab === 'settings' && <SettingsPage />}
        {activeTab === 'components' && (
          <ErrorBoundary fallbackName="Component Library">
            <LibraryBrowser />
          </ErrorBoundary>
        )}
      </main>
    </div>
  );
}

export default App;
