import React, { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { useDeviceStore } from "../store/useDeviceStore";
import { getChartPalette, getCssVar } from "../utils/theme";
import { formatDate } from "../utils/date";
import { ExportDropdown } from "./ExportDropdown";
import { Activity, RefreshCw } from "lucide-react";

export const FlowChart: React.FC = () => {
  const { selectedDeviceIds, devices, samplesByDevice, isDarkMode, syncAndFetchSamples, isSyncing } =
    useDeviceStore();


  const selectedDevices = useMemo(() => {
    return devices.filter((d) => selectedDeviceIds.includes(d.id));
  }, [devices, selectedDeviceIds]);

  const chartOption = useMemo(() => {
    const palette = getChartPalette();
    const textColor = getCssVar("--text-main", "#0f172a");
    const mutedColor = getCssVar("--text-muted", "#64748b");
    const gridColor = getCssVar("--chart-grid", "#e2e8f0");
    const cardBg = getCssVar("--bg-card", "#ffffff");

    const seriesData = selectedDevices.map((dev, idx) => {
      const samples = samplesByDevice[dev.id] || [];
      const color = palette[idx % palette.length];

      return {
        name: dev.name,
        type: "line",
        smooth: false,
        showSymbol: false,
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
              { offset: 0, color: `${color}40` },
              { offset: 1, color: `${color}00` },
            ],
          },
        },
        data: samples.map((s) => [
          new Date(s.timestamp * 1000).toISOString(),
          s.volume,
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
          let result = `<div style="font-size:12px; font-weight:600; color:${mutedColor}; margin-bottom:4px;">
            ${formatDate(params[0].value[0])}
          </div>`;
          params.forEach((item) => {
            result += `<div style="display:flex; align-items:center; justify-content:space-between; gap:16px; margin-top:2px;">
              <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background-color:${item.color};"></span>
              <span style="color:${textColor}; font-weight:500;">${item.seriesName}</span>
              <strong style="color:${textColor};">${item.value[1].toLocaleString()} Litros</strong>
            </div>`;
          });
          return result;
        },
      },
      legend: {
        top: "8px",
        textStyle: { color: textColor },
      },
      grid: {
        left: "4%",
        right: "4%",
        bottom: "16%",
        top: "14%",
        containLabel: true,
      },
      xAxis: {
        type: "time",
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



      yAxis: {
        type: "value",
        name: "Volumen (Litros)",
        nameTextStyle: { color: mutedColor },
        axisLine: { show: false },
        axisLabel: { color: mutedColor },
        splitLine: { lineStyle: { color: gridColor, type: "dashed" } },
      },
      dataZoom: [
        {
          type: "inside",
          start: 0,
          end: 100,
        },
        {
          type: "slider",
          show: true,
          bottom: "12px",
          height: 20,
          borderColor: gridColor,
          fillerColor: "rgba(2, 132, 199, 0.15)",
          textStyle: { color: mutedColor },
        },
      ],
      series: seriesData,
    };
  }, [selectedDevices, samplesByDevice, isDarkMode]);

  const hasSamples = selectedDevices.some(
    (dev) => (samplesByDevice[dev.id] || []).length > 0
  );

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-card)] border border-[var(--border-color)] rounded-xl shadow-xs p-4 overflow-hidden relative">
      <div className="flex items-center justify-between pb-3 mb-2 border-b border-[var(--border-color)]">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-[var(--color-primary)]" />
          <h2 className="text-base font-semibold text-[var(--text-main)]">
            Gráfico de Mediciones de Caudal
          </h2>
        </div>

        <div className="flex items-center gap-2">
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
        <div className="flex-1 w-full h-full min-h-[350px]">
          <ReactECharts
            option={chartOption}
            style={{ width: "100%", height: "100%" }}
            notMerge={true}
            lazyUpdate={true}
          />
        </div>
      )}
    </div>
  );
};
