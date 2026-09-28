import React, { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { useDeviceStore } from "../store/useDeviceStore";
import { getChartPalette, getCssVar } from "../utils/theme";
import { formatDate } from "../utils/date";
import { ExportDropdown } from "./ExportDropdown";
import { Toast, ToastMessage } from "./Toast";
import {
  Activity,
  RefreshCw,
  BarChart2,
  Wrench,
  Droplet,
  Layers,
} from "lucide-react";

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
  const [chartMode, setChartMode] = useState<"temporal" | "monthly_grouped">("temporal");

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

  // 1. Cálculo del volumen consumido por sensor en el intervalo seleccionado (Summary Cards)
  const { intervalSummaryCards, totalIntervalVolume } = useMemo(() => {
    const palette = getChartPalette();
    let totalVolume = 0;

    const cards = selectedDevices.map((dev, idx) => {
      const samples = samplesByDevice[dev.id] || [];
      const devVolume = samples.reduce((acc, s) => {
        if (s.timestamp >= dateRange.startTs && s.timestamp <= dateRange.endTs) {
          return acc + s.volume;
        }
        return acc;
      }, 0);

      totalVolume += devVolume;

      return {
        id: dev.id,
        name: dev.name,
        volume: devVolume,
        color: palette[idx % palette.length],
      };
    });

    return { intervalSummaryCards: cards, totalIntervalVolume: totalVolume };
  }, [selectedDevices, samplesByDevice, dateRange]);

  // 2. Configuración de Gráficos Duales (Modo Vista Temporal)
  const chartOptionTemporal = useMemo(() => {
    const palette = getChartPalette();
    const textColor = getCssVar("--text-main", "#0f172a");
    const mutedColor = getCssVar("--text-muted", "#64748b");
    const gridColor = getCssVar("--chart-grid", "#e2e8f0");
    const cardBg = getCssVar("--bg-card", "#ffffff");

    const minTime = dateRange.startTs * 1000;
    const maxTime = dateRange.endTs * 1000;

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

  // 3. Determinación de agrupamiento (Semanal si el rango < 3 meses / 90 días, Mensual en caso contrario)
  const isWeekly = useMemo(() => {
    const rangeDays = (dateRange.endTs - dateRange.startTs) / (24 * 3600);
    return rangeDays < 90;
  }, [dateRange]);

  // 4. Configuración de Gráfico de Barras Agrupadas (Modo Acumulado Histórico Semanal / Mensual)
  const chartOptionGrouped = useMemo(() => {
    const palette = getChartPalette();
    const textColor = getCssVar("--text-main", "#0f172a");
    const mutedColor = getCssVar("--text-muted", "#64748b");
    const gridColor = getCssVar("--chart-grid", "#e2e8f0");
    const cardBg = getCssVar("--bg-card", "#ffffff");

    // Generar la secuencia continua de todos los períodos (semanas o meses) en el rango [startTs, endTs]
    const sortedGroupKeys: string[] = [];
    const startDate = new Date(dateRange.startTs * 1000);
    const endDate = new Date(dateRange.endTs * 1000);

    if (isWeekly) {
      const curr = new Date(startDate);
      const day = curr.getDay();
      const diff = curr.getDate() - day + (day === 0 ? -6 : 1);
      curr.setDate(diff);

      while (curr <= endDate || curr.getTime() <= endDate.getTime() + 6 * 24 * 3600 * 1000) {
        const weekEnd = new Date(curr);
        weekEnd.setDate(weekEnd.getDate() + 6);
        if (weekEnd >= startDate && curr <= endDate) {
          const year = curr.getFullYear();
          const month = String(curr.getMonth() + 1).padStart(2, "0");
          const dateNum = String(curr.getDate()).padStart(2, "0");
          const key = `${year}-${month}-${dateNum}`;
          if (!sortedGroupKeys.includes(key)) {
            sortedGroupKeys.push(key);
          }
        }
        curr.setDate(curr.getDate() + 7);
      }
    } else {
      const curr = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      const endMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);

      while (curr <= endMonth) {
        const year = curr.getFullYear();
        const month = String(curr.getMonth() + 1).padStart(2, "0");
        const key = `${year}-${month}`;
        if (!sortedGroupKeys.includes(key)) {
          sortedGroupKeys.push(key);
        }
        curr.setMonth(curr.getMonth() + 1);
      }
    }

    sortedGroupKeys.sort();

    // Mapear muestras existentes a cada período
    const groupMap: Record<string, Record<string, number>> = {};

    selectedDevices.forEach((dev) => {
      const samples = samplesByDevice[dev.id] || [];
      samples.forEach((s) => {
        if (s.timestamp < dateRange.startTs || s.timestamp > dateRange.endTs) return;

        let groupKey = "";
        if (isWeekly) {
          const d = new Date(s.timestamp * 1000);
          const day = d.getDay();
          const diff = d.getDate() - day + (day === 0 ? -6 : 1);
          const monday = new Date(d);
          monday.setDate(diff);
          const year = monday.getFullYear();
          const month = String(monday.getMonth() + 1).padStart(2, "0");
          const dateNum = String(monday.getDate()).padStart(2, "0");
          groupKey = `${year}-${month}-${dateNum}`;
        } else {
          const d = new Date(s.timestamp * 1000);
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, "0");
          groupKey = `${year}-${month}`;
        }

        if (!groupMap[groupKey]) {
          groupMap[groupKey] = {};
        }
        groupMap[groupKey][dev.id] = (groupMap[groupKey][dev.id] || 0) + s.volume;
      });
    });

    const formattedXAxisLabels = sortedGroupKeys.map((key) => {
      if (isWeekly) {
        const parts = key.split("-");
        return `Sem. ${parts[2]}/${parts[1]}`;
      }
      return key;
    });

    const series = selectedDevices.map((dev, idx) => {
      const color = palette[idx % palette.length];
      const data = sortedGroupKeys.map((k) => groupMap[k]?.[dev.id] || 0);

      return {
        name: dev.name,
        type: "bar",
        barMaxWidth: 24,
        barGap: "15%",
        itemStyle: {
          color,
          borderRadius: [4, 4, 0, 0],
        },
        data,
      };
    });

    const yAxisName = isWeekly ? "Acumulado Semanal (Litros)" : "Acumulado Mensual (Litros)";

    return {
      backgroundColor: cardBg,
      tooltip: {
        trigger: "axis",
        backgroundColor: cardBg,
        borderColor: gridColor,
        textStyle: { color: textColor },
        axisPointer: { type: "shadow" },
        formatter: (params: any[]) => {
          if (!params || params.length === 0) return "";
          const labelIndex = params[0].dataIndex;
          const key = sortedGroupKeys[labelIndex];
          const displayLabel = isWeekly
            ? `Semana del ${key.split("-")[2]}/${key.split("-")[1]}/${key.split("-")[0]}`
            : `Mes: ${key}`;

          let result = `<div style="font-size:12px; font-weight:600; color:${mutedColor}; margin-bottom:6px;">
            ${displayLabel}
          </div>`;
          params.forEach((item) => {
            result += `<div style="display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:3px;">
              <div style="display:flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${item.color};"></span>
                <span style="color:${textColor}; font-weight:500;">${item.seriesName}</span>
              </div>
              <strong style="color:${textColor};">${item.value.toLocaleString()} L</strong>
            </div>`;
          });
          return result;
        },
      },
      legend: {
        top: "0px",
        textStyle: { color: textColor, fontWeight: 500 },
      },
      grid: {
        left: "4%",
        right: "4%",
        top: "40px",
        bottom: "10%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: formattedXAxisLabels,
        axisLine: { lineStyle: { color: gridColor } },
        axisLabel: { color: mutedColor, fontWeight: 600 },
      },
      yAxis: {
        type: "value",
        name: yAxisName,
        nameTextStyle: { color: mutedColor, fontWeight: 600, fontSize: 11 },
        axisLine: { show: false },
        axisLabel: { color: mutedColor },
        splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
      },
      series,
    };
  }, [selectedDevices, samplesByDevice, dateRange, isWeekly, isDarkMode]);

  const hasSamples = selectedDevices.some(
    (dev) => (samplesByDevice[dev.id] || []).length > 0
  );

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xs p-4 overflow-hidden relative">
      {/* Cabecera Superior */}
      <div className="flex flex-wrap items-center justify-between pb-3 mb-3 border-b border-[var(--border-color)] gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Activity className="w-5 h-5 text-[var(--color-primary)]" />
            <h2 className="text-base font-semibold text-[var(--text-main)]">
              Mediciones de Caudal
            </h2>
          </div>

          {/* Selector de Modo de Gráficos (Vista Temporal vs Histórico Semanal/Mensual) */}
          <div className="flex items-center bg-[var(--bg-main)] border border-[var(--border-color)] rounded-lg p-0.5 ml-2">
            <button
              onClick={() => setChartMode("temporal")}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                chartMode === "temporal"
                  ? "bg-[var(--color-primary)] text-white shadow-2xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              <BarChart2 className="w-3.5 h-3.5" />
              <span>Vista Temporal</span>
            </button>

            <button
              onClick={() => setChartMode("monthly_grouped")}
              className={`flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                chartMode === "monthly_grouped"
                  ? "bg-[var(--color-primary)] text-white shadow-2xs"
                  : "text-[var(--text-muted)] hover:text-[var(--text-main)]"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isWeekly ? "Histórico Semanal" : "Histórico Mensual"}</span>
            </button>
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

      {/* Fila de Summary Cards (Resumen de Volumen en el Intervalo) */}
      {selectedDeviceIds.length > 0 && hasSamples && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 mb-3 shrink-0">
          {/* Card Total Acumulado */}
          <div className="bg-[var(--bg-main)]/80 border-2 border-[var(--color-primary)]/40 rounded-xl p-2.5 flex flex-col justify-between shadow-2xs">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--color-primary)] truncate">
              <Droplet className="w-3.5 h-3.5 fill-current shrink-0" />
              <span className="truncate">Total Acumulado</span>
            </div>
            <div className="text-base font-extrabold text-[var(--text-main)] mt-1 font-mono">
              {totalIntervalVolume.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)] font-sans">L</span>
            </div>
          </div>

          {/* Cards por Sensor */}
          {intervalSummaryCards.map((card) => (
            <div
              key={card.id}
              className="bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl p-2.5 flex flex-col justify-between shadow-2xs"
            >
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-muted)] truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: card.color }}
                />
                <span className="truncate">{card.name}</span>
              </div>
              <div className="text-base font-extrabold text-[var(--text-main)] mt-1 font-mono">
                {card.volume.toLocaleString()} <span className="text-xs font-normal text-[var(--text-muted)] font-sans">L</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Área del Gráfico o Estados Vacíos */}
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
        <div className="flex-1 w-full h-full min-h-[380px]">
          <ReactECharts
            option={chartMode === "temporal" ? chartOptionTemporal : chartOptionGrouped}
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
