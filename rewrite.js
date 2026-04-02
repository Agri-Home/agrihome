const fs = require('fs');

const content = \`
\"use client\";

import Image from \"next/image\";
import { useEffect, useState } from \"react\";
import { Badge } from \"@/components/atoms/Badge\";
import { Button } from \"@/components/atoms/Button\";
import { Card } from \"@/components/atoms/Card\";
import type { CameraCapture, MonitoringEvent, PredictionResult } from \"@/lib/types/domain\";
import { clampPercent, formatDateTime, formatRelativeTimestamp } from \"@/lib/utils\";

const AUTO_REFRESH_MS = Number(process.env.NEXT_PUBLIC_AUTO_REFRESH_MS ?? 15000);

interface DashboardTemplateProps {
  initialLatestImage: CameraCapture | null;
  initialLatestPrediction: PredictionResult | null;
  initialMonitoringLog: MonitoringEvent[];
}

interface ApiResponse<T> {
  data: T;
  refreshedAt?: string;
}

const navItems = [\"Overview\", \"Live Feed\", \"History\", \"Hardware\"];

const toneForSeverity = (severity?: PredictionResult[\"severity\"]) => {
  if (severity === \"high\") return \"critical\" as const;
  if (severity === \"medium\") return \"warning\" as const;
  return \"success\" as const;
};

const toneForLevel = (level: MonitoringEvent[\"level\"]) => {
  if (level === \"critical\") return \"critical\" as const;
  if (level === \"warning\") return \"warning\" as const;
  return \"success\" as const;
};

function MiniStat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className=\"flex flex-col p-4 bg-white border border-gray-100 rounded-xl transition-all hover:border-gray-200 hover:shadow-sm\">
      <span className=\"text-xs font-medium text-gray-500 uppercase tracking-wider\">{label}</span>
      <span className=\"mt-2 text-2xl font-semibold text-gray-900\">{value}</span>
      {detail && <span className=\"mt-1 text-sm text-gray-500\">{detail}</span>}
    </div>
  );
}

function EventRow({ event, active, onSelect }: { event: MonitoringEvent; active: boolean; onSelect: () => void }) {
  return (
    <button
      onClick={onSelect}
      className={\\`w-full flex items-start justify-between p-4 text-left transition-all rounded-xl border ${active ? 'border-gray-300 bg-gray-50 shadow-sm' : 'border-transparent hover:bg-gray-50 hover:border-gray-200'}\\`}
    >
      <div className=\"flex flex-col gap-1.5\">
        <div className=\"flex items-center gap-2\">
          <Badge tone={toneForLevel(event.level)}>{event.level}</Badge>
          <span className=\"text-sm font-medium text-gray-900\">{event.title}</span>
        </div>
        <p className=\"text-sm text-gray-500 line-clamp-1\">{event.message}</p>
      </div>
      <span className=\"text-xs text-gray-400 whitespace-nowrap mt-1\">{formatRelativeTimestamp(event.createdAt)}</span>
    </button>
  );
}

export function DashboardTemplate({
  initialLatestImage,
  initialLatestPrediction,
  initialMonitoringLog
}: DashboardTemplateProps) {
  const [latestImage, setLatestImage] = useState(initialLatestImage);
  const [latestPrediction, setLatestPrediction] = useState(initialLatestPrediction);
  const [monitoringLog, setMonitoringLog] = useState(initialMonitoringLog);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(initialMonitoringLog[0]?.id ?? null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(new Date().toISOString());

  const refreshDashboard = async () => {
    setIsRefreshing(true);
    try {
      const [imgRes, predRes, monRes] = await Promise.all([
        fetch(\"/api/camera/latest\", { cache: \"no-store\" }),
        fetch(\"/api/predictions/latest\", { cache: \"no-store\" }),
        fetch(\"/api/monitoring/log?limit=8\", { cache: \"no-store\" })
      ]);
      const [imgJson, predJson, monJson] = await Promise.all([imgRes.json(), predRes.json(), monRes.json()]);
      setLatestImage(imgJson.data);
      setLatestPrediction(predJson.data);
      setMonitoringLog(monJson.data);
      setLastUpdatedAt(imgJson.refreshedAt ?? new Date().toISOString());
      setErrorMessage(null);
    } catch {
      setErrorMessage(\"System failed to re-sync. Displaying cached data.\");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!autoRefreshEnabled) return;
    const intervalId = window.setInterval(refreshDashboard, AUTO_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [autoRefreshEnabled]);

  const summaryLog = monitoringLog.slice(0, 8);
  const selectedEvent = summaryLog.find((e) => e.id === selectedEventId) ?? summaryLog[0] ?? null;
  const captureAvailable = Boolean(latestImage?.imageUrl);

  return (
    <main className=\"min-h-screen bg-gray-50/50 p-4 sm:p-8 lg:p-12 font-sans selection:bg-gray-200\">
      <div className=\"mx-auto max-w-7xl flex flex-col gap-8\">
        
        {/* Header Section */}
        <header className=\"flex flex-col gap-6 md:flex-row md:items-end md:justify-between pb-6 border-b border-gray-200/60\">
          <div>
            <div className=\"flex items-center gap-3 mb-2\">
              <div className=\"h-3 w-3 rounded-full bg-emerald-500 animate-pulse ring-4 ring-emerald-500/20\" />
              <span className=\"text-xs font-semibold uppercase tracking-wider text-emerald-600\">Live System</span>
            </div>
            <h1 className=\"text-3xl sm:text-4xl font-semibold tracking-tight text-gray-900\">Platform Overview</h1>
            <p className=\"mt-2 text-gray-500 text-sm max-w-lg\">Monitoring operations, predicting health patterns, and continuously syncing with the hardware module over edge network.</p>
          </div>
          
          <div className=\"flex flex-col items-start md:items-end gap-3\">
            <div className=\"flex gap-2\">
              {navItems.map((item, idx) => (
                <button key={item} className={\\`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${idx === 0 ? \"bg-gray-900 text-white shadow-sm\" : \"text-gray-600 hover:bg-gray-100 hover:text-gray-900\"}\\`}>{item}</button>
              ))}
            </div>
            <div className=\"flex items-center gap-2\">
              <Badge tone={captureAvailable ? \"success\" : \"warning\"}>{captureAvailable ? \"Optics Online\" : \"Degraded Link\"}</Badge>
              <Badge tone={toneForSeverity(latestPrediction?.severity)}>{latestPrediction?.label ?? \"Analyzing...\"}</Badge>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className=\"bg-rose-50 border border-rose-100 text-rose-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2\">
            {errorMessage}
          </div>
        )}

        {/* Main Dashboard Grid */}
        <div className=\"grid grid-cols-1 lg:grid-cols-3 gap-8\">
          
          {/* Left Column: Camera feed & Quick Actions */}
          <div className=\"lg:col-span-2 flex flex-col gap-6\">
            <Card className=\"p-0 overflow-hidden flex flex-col group border border-gray-200/60\">
              <div className=\"flex items-center justify-between p-5 border-b border-gray-100 bg-white\">
                <div>
                  <h2 className=\"text-lg font-semibold text-gray-900\">Primary Optics</h2>
                  <p className=\"text-sm text-gray-500\">Live hardware feed • {lastUpdatedAt ? formatRelativeTimestamp(lastUpdatedAt) : \"Just now\"}</p>
                </div>
                <div className=\"flex items-center gap-2\">
                  <Button variant=\"secondary\" onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}>
                    {autoRefreshEnabled ? \"Pause Sync\" : \"Resume Sync\"}
                  </Button>
                  <Button variant=\"primary\" onClick={refreshDashboard} disabled={isRefreshing}>
                    {isRefreshing ? \"Syncing...\" : \"Sync\"}
                  </Button>
                </div>
              </div>
              
              <div className=\"relative aspect-[16/9] bg-gray-100 w-full overflow-hidden\">
                {captureAvailable ? (
                  <>
                    <Image src={latestImage?.imageUrl as string} alt=\"Feed\" fill className=\"object-cover transition-transform duration-700 ease-out group-hover:scale-[1.02]\" priority sizes=\"(max-width: 1280px) 100vw, 70vw\" />
                    <div className=\"absolute inset-0 bg-gradient-to-t from-gray-900/60 to-transparent\" />
                    <div className=\"absolute bottom-5 left-5 right-5 flex justify-between items-end\">
                      <div className=\"text-white\">
                        <span className=\"font-mono text-xs uppercase tracking-widest text-white/70\">{latestImage?.deviceId ?? \"DEV_01\"}</span>
                        <h3 className=\"text-2xl font-semibold mt-1 tracking-tight\">{latestPrediction?.label ?? \"Capturing...\"}</h3>
                      </div>
                      <div className=\"bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-4 py-2 text-right\">
                         <span className=\"text-xs font-medium text-white/70 uppercase\">Score</span>
                         <p className=\"text-xl font-semibold text-white\">{latestPrediction ? clampPercent(latestPrediction.confidence) : \"0%\"}</p>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className=\"absolute inset-0 flex flex-col items-center justify-center text-gray-400\">
                    <svg className=\"w-12 h-12 mb-4 text-gray-300\" fill=\"none\" viewBox=\"0 0 24 24\" stroke=\"currentColor\"><path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={1.5} d=\"M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z\" /><path strokeLinecap=\"round\" strokeLinejoin=\"round\" strokeWidth={1.5} d=\"M15 13a3 3 0 11-6 0 3 3 0 016 0z\" /></svg>
                    <span className=\"font-medium text-gray-500\">Optics Offline</span>
                    <span className=\"text-sm mt-1\">Awaiting hardware connection...</span>
                  </div>
                )}
              </div>
            </Card>

            <div className=\"grid grid-cols-1 sm:grid-cols-3 gap-4\">
              <MiniStat label=\"Pulse check\" value={lastUpdatedAt ? formatDateTime(lastUpdatedAt).split(' ')[1] : \"N/A\"} detail=\"Latest network sync\" />
              <MiniStat label=\"State\" value={captureAvailable ? \"Active\" : \"Idle\"} detail={latestImage?.notes ?? \"Stable condition.\"} />
              <MiniStat label=\"Routing\" value=\"Ingest -> ML\" detail=\"End-to-end edge path\" />
            </div>
          </div>

          {/* Right Column: AI Context */}
          <div className=\"flex flex-col gap-6\">
            <Card className=\"flex flex-col h-full bg-white border border-gray-200/60 p-6\">
              <div className=\"mb-6 flex justify-between items-start\">
                <h3 className=\"text-lg font-semibold text-gray-900\">Intelligence</h3>
                <Badge tone={toneForSeverity(latestPrediction?.severity)}>{latestPrediction?.severity ?? \"Pending\"}</Badge>
              </div>
              
              <div className=\"flex-1\">
                <div className=\"mb-8\">
                  <span className=\"text-xs font-semibold text-gray-400 uppercase tracking-wider\">Classification</span>
                  <p className=\"mt-1 text-2xl font-semibold text-gray-900 tracking-tight\">{latestPrediction?.label ?? \"Analyzing environment\"}</p>
                </div>
                
                <div className=\"mb-8\">
                  <span className=\"text-xs font-semibold text-gray-400 uppercase tracking-wider\">Action Plan</span>
                  <p className=\"mt-2 text-sm leading-relaxed text-gray-600\">{latestPrediction?.recommendation ?? \"No operational guidance required at this moment. The intelligence engine is actively monitoring.\"}</p>
                </div>
                
                <div className=\"space-y-4\">
                  <span className=\"text-xs font-semibold text-gray-400 uppercase tracking-wider\">Nearest Vectors</span>
                  <div className=\"space-y-2\">
                    {latestPrediction?.similarMatches ? (
                      latestPrediction.similarMatches.slice(0, 3).map(match => (
                        <div key={match.id} className=\"flex justify-between items-center bg-gray-50 rounded-lg p-3 border border-gray-100\">
                          <span className=\"text-sm font-medium text-gray-700\">{match.label}</span>
                          <span className=\"text-xs font-mono bg-white px-2 py-1 rounded shadow-sm border border-gray-100\">{clampPercent(match.score)}</span>
                        </div>
                      ))
                    ) : (
                      <p className=\"text-sm text-gray-400 italic\">No vector data established.</p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Bottom Row: Logs and Flow logs */}
        <div className=\"grid grid-cols-1 lg:grid-cols-2 gap-8\">
            <Card className=\"border border-gray-200/60 bg-white p-6\">
              <div className=\"flex items-center justify-between mb-6\">
                  <h3 className=\"text-lg font-semibold text-gray-900\">System Logs</h3>
                  <span className=\"bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-md font-medium\">{summaryLog.length} recorded</span>
              </div>
              <div className=\"flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-2\">
                {summaryLog.length > 0 ? summaryLog.map((event) => (
                  <EventRow key={event.id} event={event} active={selectedEvent?.id === event.id} onSelect={() => setSelectedEventId(event.id)} />
                )) : (
                  <div className=\"py-8 text-center text-sm text-gray-400 border border-dashed border-gray-200 rounded-xl\">Event history empty.</div>
                )}
              </div>
            </Card>

            <Card className=\"border border-gray-200/60 bg-white p-6\">
              <h3 className=\"text-lg font-semibold text-gray-900 mb-6\">Trace Inspection: {selectedEvent?.id?.slice(0,6) || \"N/A\"}</h3>
              {selectedEvent ? (
                <div className=\"flex flex-col h-full justify-between\">
                  <div>
                    <Badge tone={toneForLevel(selectedEvent.level)} className=\"mb-3\">{selectedEvent.level}</Badge>
                    <h4 className=\"text-2xl font-semibold text-gray-900 tracking-tight\">{selectedEvent.title}</h4>
                    <p className=\"mt-4 text-gray-600 leading-relaxed\">{selectedEvent.message}</p>
                  </div>
                  <div className=\"grid grid-cols-2 gap-4 mt-8 pt-6 border-t border-gray-100\">
                    <div>
                      <span className=\"block text-xs font-semibold text-gray-400 uppercase\">Timestamp</span>
                      <span className=\"block mt-1 font-medium text-gray-900\">{formatDateTime(selectedEvent.createdAt)}</span>
                    </div>
                    <div>
                      <span className=\"block text-xs font-semibold text-gray-400 uppercase\">Capture Node</span>
                      <span className=\"block mt-1 font-mono text-sm text-gray-900\">{selectedEvent.captureId ?? \"Generic\"}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className=\"h-full flex items-center justify-center text-sm text-gray-400\">Select an event from the logs.</div>
              )}
            </Card>
        </div>

      </div>
    </main>
  );
}
\`;

fs.writeFileSync('src/components/templates/DashboardTemplate.tsx', content);
