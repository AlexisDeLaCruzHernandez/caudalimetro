import { useEffect } from "react";

import { Header } from "./components/Header";
import { DeviceList } from "./components/DeviceList";
import { DateRangePicker } from "./components/DateRangePicker";
import { FlowChart } from "./components/FlowChart";
import { useDeviceStore } from "./store/useDeviceStore";
import { AlertCircle } from "lucide-react";

const SYNC_INTERVAL_MS =
  (Number(import.meta.env.VITE_SYNC_INTERVAL_SEC) || 60) * 1000;

export function App() {
  const { discoverDevices, syncAndFetchSamples, error } = useDeviceStore();

  useEffect(() => {
    discoverDevices();
  }, [discoverDevices]);

  // Sincronización automática de datos periódica mientras la app esté abierta (ADR 0002)
  useEffect(() => {
    const timer = setInterval(() => {
      syncAndFetchSamples();
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [syncAndFetchSamples]);


  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--bg-main)] text-[var(--text-main)] overflow-hidden font-sans">
      <Header />

      {error && (
        <div className="bg-red-500/10 border-b border-red-500/20 text-red-600 dark:text-red-400 px-4 py-2 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex-1 flex overflow-hidden">
        <DeviceList />

        <main className="flex-1 flex flex-col p-4 gap-4 overflow-y-auto">
          <DateRangePicker />
          <FlowChart />
        </main>
      </div>
    </div>
  );
}

export default App;
