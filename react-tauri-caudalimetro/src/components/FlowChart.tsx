import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useDeviceStore } from "../store/useDeviceStore";
import { getChartPalette, getCssVar } from "../utils/theme";
import { formatDate } from "../utils/date";
import { ExportDropdown } from "./ExportDropdown";
import { Toast, ToastMessage } from "./Toast";
import { Activity, RefreshCw, BarChart2, TrendingUp, Wrench } from "lucide-react";

export const FlowChart: React.FC = () => {
  const {
    selectedDeviceIds,
    devices,
    samplesByDevice,
    dateRange,
    isDarkMode,
    syncAndFetchSamples,
    isSyncing,
    recalculateAccumulated,
  } = useDeviceStore();

  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const selectedDevices = useMemo(() => {
    return devices.filter((d) => selectedDeviceIds.includes(d.id));
  }, [devices, selectedDeviceIds]);

  const handleRecalculateDebug = async () => {
    setIsRecalculating(true);
    setToast(null);
    try {
      const count = await recalculateAccumulated();
      setToast({
        id: Date.now().toString(),
        type: "success",
        title: "Recálculo Completo (Debug)",
        message: `Se recalcularon ${count} muestras en la BD SQLite.`,
      });
    } catch (e: any) {
      setToast({
        id: Date.now().toString(),
        type: "error",
        title: "Error de Recálculo",
        message: e?.message || e?.toString() || "Error al recalcular acumulados.",
      });
    } finally {
      setIsRecalculating(false);
    }
  };

  const chartOption = useMemo(() => {
    const palette = getChartPalette();
    const textColor = getCssVar("--text-main", "#0f172a");
    const mutedColor = getCssVar("--text-muted", "#64748b");
    const gridColor = getCssVar("--chart-grid", "#e2e8f0");
    const cardBg = getCssVar("--bg-card", "#ffffff");

    const minTime = dateRange.startTs * 1000;
    const maxTime = dateRange.endTs * 1000;

    // 1. Series de Barras para Caudal por Intervalo (Grid 0 - Superior)
    const intervalBarSeries = selectedDevices.map((dev, idx) => {
      const samples = samplesByDevice[dev.id] || [];
      const color = palette[idx % palette.length];

      return {
        name: dev.name,
        type: "bar",
        xAxisIndex: 0,
        yAxisIndex: 0,
        barMaxWidth: 14,
        itemStyle: {
          color,
          borderRadius: [3, 3, 0, 0],
        },
        data: samples.map((s) => [s.timestamp * 1000, s.volume]),
      };
    });

    // 2. Series de Líneas con Gradiente para Acumulado Mensual (Grid 1 - Inferior)
    const accumulatedLineSeries = selectedDevices.map((dev, idx) => {
      const samples = samplesByDevice[dev.id] || [];
      const color = palette[idx % palette.length];

      return {
        name: dev.name,
        type: "line",
        xAxisIndex: 1,
        yAxisIndex: 1,
        showSymbol: false,
        smooth: false,
        lineStyle: {
          width: 2.5,
          color,
        },
        itemStyle: {
          color,
        },
        areaStyle: {
          color: {
            type: "linear",
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: `${color}45` },
              { offset: 1, color: `${color}05` },
            ],
          },
        },
        data: samples.map((s) => [
          s.timestamp * 1000,
          s.monthly_accumulated ?? s.volume,
        ]),
      };
    });

    return {
      backgroundColor: cardBg,
      tooltip: {
        trigger: "axis",
        backgroundColor: cardBg,
        borderColor: gridColor,
        textStyle: { color: textColor },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          const firstTs = params[0].value[0];
          let result = `<div style="font-size:12px; font-weight:600; color:${mutedColor}; margin-bottom:6px;">
            ${formatDate(firstTs)}
          </div>`;

          params.forEach((item) => {
            const isBar = item.seriesType === "bar";
            const labelType = isBar ? "Intervalo" : "Acumulado Mensual";
            result += `<div style="display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:3px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${item.color};"></span>
                <span style="color:${textColor}; font-weight:500;">${item.seriesName} <span style="font-size:10px; opacity:0.75;">(${labelType})</span></span>
              </div>
              <strong style="color:${textColor};">${item.value[1].toLocaleString()} L</strong>
            </div>`;
          });
          return result;
        },
      },
      legend: {
        top: "0px",
        textStyle: { color: textColor, fontWeight: 500 },
      },
      axisPointer: {
        link: [{ xAxisIndex: "all" }],
      },
      grid: [
        {
          left: "5%",
          right: "4%",
          top: "30px",
          height: "38%",
          containLabel: true,
        },
        {
          left: "5%",
          right: "4%",
          top: "52%",
          height: "38%",
          containLabel: true,
        },
      ],
      xAxis: [
        {
          gridIndex: 0,
          type: "time",
          min: minTime,
          max: maxTime,
          axisLine: { lineStyle: { color: gridColor } },
          axisLabel: {
            color: mutedColor,
            formatter: {
              year: "{yyyy}/{MM}/{dd}",
              month: "{yyyy}/{MM}/{dd}",
              day: "{yyyy}/{MM}/{dd}",
              hour: "{HH}:{mm}",
              minute: "{HH}:{mm}",
            },
          },
          splitLine: { show: false },
        },
        {
          gridIndex: 1,
          type: "time",
          min: minTime,
          max: maxTime,
          axisLine: { lineStyle: { color: gridColor } },
          axisLabel: {
            color: mutedColor,
            formatter: {
              year: "{yyyy}/{MM}/{dd}",
              month: "{yyyy}/{MM}/{dd}",
              day: "{yyyy}/{MM}/{dd}",
              hour: "{HH}:{mm}",
              minute: "{HH}:{mm}",
            },
          },
          splitLine: { show: false },
        },
      ],
      yAxis: [
        {
          gridIndex: 0,
          type: "value",
          name: "Intervalo (Litros)",
          nameLocation: "end",
          nameGap: 10,
          nameTextStyle: { color: mutedColor, fontWeight: 600, fontSize: 11, align: "left" },
          axisLine: { show: false },
          axisLabel: { color: mutedColor },
          splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
        },
        {
          gridIndex: 1,
          type: "value",
          name: "Acumulado Mensual (Litros)",
          nameLocation: "end",
          nameGap: 10,
          nameTextStyle: { color: mutedColor, fontWeight: 600, fontSize: 11, align: "left" },
          axisLine: { show: false },
          axisLabel: { color: mutedColor },
          splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
        },
      ],
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: [0, 1],
        },
      ],
      series: [...intervalBarSeries, ...accumulatedLineSeries],
    };
  }, [selectedDevices, samplesByDevice, dateRange, isDarkMode]);

  const hasSamples = selectedDevices.some(
    (dev) => (samplesByDevice[dev.id] || []).length > 0
  );

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xs p-4 overflow-hidden relative">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Activity className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-base font-semibold text-[var(--text-main)]">
              Mediciones de Caudal
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] border-l border-[var(--border-color)] pl-3">
            <span className="flex items-center gap-1">
              <BarChart2 className="w-3.5 h-3.5 text-blue-500" />
              Intervalo (Barras)
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
              Acumulado Mensual (Gradiente)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Botón de Debug para Recalcular Acumulados */}
          <button
            onClick={handleRecalculateDebug}
            disabled={isRecalculating}
            title="Recalcular acumulados mensuales en SQLite (Debug)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/60 disabled:opacity-50 rounded-lg transition-all shadow-2xs cursor-pointer select-none"
          >
            <Wrench className={`w-3.5 h-3.5 text-amber-600 dark:text-amber-400 ${isRecalculating ? "animate-spin" : ""}`} />
            <span>Recalcular DB</span>
          </button>

          <ExportDropdown />

          <button
            onClick={() => syncAndFetchSamples()}
            disabled={isSyncing || selectedDeviceIds.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 rounded-lg transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "Sincronizando..." : "Sincronizar Datos"}
          </button>
        </div>
      </div>

      {selectedDeviceIds.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--text-muted)] p-6">
          <Activity className="w-12 h-12 stroke-1 mb-2 opacity-50 text-[var(--color-primary)]" />
          <p className="text-sm font-medium">No hay dispositivos seleccionados</p>
          <p className="text-xs opacity-75 mt-1">
            Selecciona uno o más caudalímetros en la barra lateral para ver su historial.
          </p>
        </div>
      ) : !hasSamples ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-[var(--text-muted)] p-6">
          <RefreshCw className="w-10 h-10 stroke-1 mb-2 opacity-40 text-[var(--color-primary)] animate-pulse" />
          <p className="text-sm font-medium">Sin datos para el rango de fechas seleccionado</p>
          <p className="text-xs opacity-75 mt-1 max-w-sm">
            Presiona &quot;Sincronizar Datos&quot; para descargar las muestras más recientes directamente del ESP32.
          </p>
        </div>
      ) : (
        <div className="flex-1 w-full h-full min-h-[400px]">
          <ReactECharts
            option={chartOption}
            style={{ width: "100%", height: "100%" }}
            notMerge={true}
            lazyUpdate={true}
          />
        </div>
      )}

      {/* Componente Toast de Notificaciones */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
};
