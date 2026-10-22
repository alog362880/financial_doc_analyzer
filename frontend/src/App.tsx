import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { FolderOpen, LayoutDashboard, ShieldCheck } from "lucide-react";
import { Dashboard } from "./components/Dashboard";
import { DocumentDetail } from "./components/DocumentDetail";
import { DocumentList } from "./components/DocumentList";
import { UploadZone } from "./components/UploadZone";

type View = { name: "dashboard" } | { name: "documents" } | { name: "detail"; documentId: string };

export default function App() {
  const [view, setView] = useState<View>({ name: "dashboard" });
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploaded = useCallback(() => setRefreshKey((key) => key + 1), []);
  const openDocument = useCallback((documentId: string) => setView({ name: "detail", documentId }), []);
  const showDocuments = useCallback(() => setView({ name: "documents" }), []);

  const activeTab = view.name === "detail" ? "documents" : view.name;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-blue-700" aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-900 sm:text-base">Financial Document &amp; Policy Analyzer</span>
          </div>
          <nav className="ml-auto flex gap-1 rounded-lg bg-slate-100 p-1" aria-label="Main">
            <NavButton
              active={activeTab === "dashboard"}
              onClick={() => setView({ name: "dashboard" })}
              icon={<LayoutDashboard className="h-4 w-4" aria-hidden="true" />}
              label="Dashboard"
            />
            <NavButton
              active={activeTab === "documents"}
              onClick={showDocuments}
              icon={<FolderOpen className="h-4 w-4" aria-hidden="true" />}
              label="Documents"
            />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {view.name === "dashboard" && <Dashboard onSelectDocument={openDocument} />}

        {view.name === "documents" && (
          <div className="space-y-8">
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Upload a document</h2>
              <UploadZone onUploaded={handleUploaded} />
            </div>
            <div>
              <h2 className="mb-3 text-lg font-semibold text-slate-900">Ingested documents</h2>
              <DocumentList refreshKey={refreshKey} onSelectDocument={openDocument} />
            </div>
          </div>
        )}

        {view.name === "detail" && (
          <DocumentDetail key={view.documentId} documentId={view.documentId} onBack={showDocuments} />
        )}
      </main>
    </div>
  );
}

interface NavButtonProps {
  active: boolean;
  onClick: () => void;
  icon: ReactNode;
  label: string;
}

function NavButton({ active, onClick, icon, label }: NavButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
