import { useMeasureStore } from './stores/measureStore';
import { Sidebar } from './components/layout/Sidebar';
import { MeasureLibrary } from './components/measure/MeasureLibrary';
import { UMSEditor } from './components/measure/UMSEditor';
import { ValidationTraceViewer } from './components/validation/ValidationTraceViewer';
import { CodeGeneration } from './components/measure/CodeGeneration';
import { ValueSetManager } from './components/valueset/ValueSetManager';
import { SettingsPage } from './components/settings/SettingsPage';
import { LibraryBrowser } from './components/library/LibraryBrowser';
import { ErrorBoundary } from './components/shared/ErrorBoundary';

function App() {
  const { activeTab } = useMeasureStore();

  return (
    <div className="h-screen flex">
      <Sidebar />
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
