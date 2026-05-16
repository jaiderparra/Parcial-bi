"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Papa from "papaparse";

interface SensorRecord {
  id_sensor: string;
  data_type: string;
  data_value: string;
  data_date: string;
  block_name: string;
}

const DATA_TYPES = ["RHUM", "TEMP", "PURO", "RASO"];
const BLOCK_NAMES = [
  "35","36","AG10","AG16","AG2","AG6","AG8","AR35",
  "B35","B36","B40","B41","B46","B54","BAG10",
  "BLQ13","BLQ14","BLQ18","BLQ22","BLQ25",
  "J12","J2","J4","J8","MANGA7",
  "SM1","SM12","SM16","SM3","SM5","SM8",
  "VLL2","VLL3"
];

const DATA_TYPE_LABELS: Record<string, string> = {
  RHUM: "Humedad",
  TEMP: "Temperatura",
  PURO: "Punto de Rocío",
  RASO: "Radiación PAR",
};

const typeColors: Record<string, string> = {
  RHUM: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  TEMP: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  PURO: "bg-violet-500/20 text-violet-300 border-violet-500/30",
  RASO: "bg-green-500/20 text-green-300 border-green-500/30",
};

const typeActiveBg: Record<string, string> = {
  RHUM: "bg-cyan-500 text-white border-cyan-400",
  TEMP: "bg-orange-500 text-white border-orange-400",
  PURO: "bg-violet-500 text-white border-violet-400",
  RASO: "bg-green-500 text-white border-green-400",
};

const PAGE_SIZE = 50;

export default function Home() {
  const [allData, setAllData] = useState<SensorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [fechaInicio, setFechaInicio] = useState("2023-01-01");
  const [fechaFin, setFechaFin] = useState("2023-12-31");
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const buffer: SensorRecord[] = [];

    Papa.parse<SensorRecord>("/sensor_data.csv", {
      download: true,
      header: true,
      skipEmptyLines: true,
      chunkSize: 1024 * 64,
      chunk: (results: Papa.ParseResult<SensorRecord>) => {
        for (const row of results.data) {
          buffer.push(row);
        }
      },
      complete: () => {
        setAllData(buffer);
        setLoading(false);
      },
      error: () => setLoading(false),
    });
  }, []);

  const filteredData = useMemo(() => {
    const start = fechaInicio ? new Date(fechaInicio + "T00:00:00") : null;
    const end = fechaFin ? new Date(fechaFin + "T23:59:59") : null;
    return allData.filter((r) => {
      const dt = new Date(r.data_date);
      if (start && dt < start) return false;
      if (end && dt > end) return false;
      if (selectedBlocks.length > 0 && !selectedBlocks.includes(r.block_name)) return false;
      if (selectedTypes.length > 0 && !selectedTypes.includes(r.data_type)) return false;
      return true;
    });
  }, [allData, fechaInicio, fechaFin, selectedBlocks, selectedTypes]);

  const paginated = useMemo(
    () => filteredData.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredData, page]
  );
  const totalPages = Math.ceil(filteredData.length / PAGE_SIZE);

  const toggleBlock = useCallback((b: string) => {
    setPage(1);
    setSelectedBlocks((prev) => prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]);
  }, []);

  const toggleType = useCallback((t: string) => {
    setPage(1);
    setSelectedTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }, []);

  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;
    const vals = filteredData.map((r) => parseFloat(r.data_value)).filter((v) => !isNaN(v));
    if (vals.length === 0) return null;
    const sum = vals.reduce((a, b) => a + b, 0);
    return { count: filteredData.length, avg: sum / vals.length, min: Math.min(...vals), max: Math.max(...vals) };
  }, [filteredData]);

  return (
    <main className="min-h-screen bg-[#0a0e1a] text-slate-100 font-mono">
      <div className="border-b border-slate-800 bg-[#0d1220]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              <span className="text-cyan-400">dept</span>maintenance
              <span className="text-slate-500 text-sm ml-3 font-normal">/ sensor dashboard</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">tbl_sensors_data_temp — BI Parcial Final</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">registros cargados</div>
            <div className="text-2xl font-bold text-cyan-400 tabular-nums">
              {loading ? "…" : allData.length.toLocaleString("es-CO")}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="max-w-7xl mx-auto px-6 py-20 flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Cargando datos del Excel...</p>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          <div className="bg-[#0d1220] border border-slate-800 rounded-xl p-5 space-y-5">
            <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Filtros</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Fecha inicio</label>
                <input type="date" value={fechaInicio}
                  onChange={(e) => { setFechaInicio(e.target.value); setPage(1); }}
                  className="w-full bg-[#0a0e1a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Fecha fin</label>
                <input type="date" value={fechaFin}
                  onChange={(e) => { setFechaFin(e.target.value); setPage(1); }}
                  className="w-full bg-[#0a0e1a] border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-cyan-500 transition-colors" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">data_type</label>
              <div className="flex flex-wrap gap-2">
                {DATA_TYPES.map((t) => (
                  <button key={t} onClick={() => toggleType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${selectedTypes.includes(t) ? typeActiveBg[t] : "bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-500"}`}>
                    {t} <span className="opacity-60 font-normal">— {DATA_TYPE_LABELS[t]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs text-slate-500">
                block_name{" "}
                {selectedBlocks.length > 0 && (
                  <button onClick={() => { setSelectedBlocks([]); setPage(1); }}
                    className="text-cyan-400 hover:text-cyan-300 ml-2 underline">
                    limpiar ({selectedBlocks.length})
                  </button>
                )}
              </label>
              <div className="flex flex-wrap gap-1.5">
                {BLOCK_NAMES.map((b) => (
                  <button key={b} onClick={() => toggleBlock(b)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${selectedBlocks.includes(b) ? "bg-cyan-500 text-white border-cyan-400" : "bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-500"}`}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => { setFechaInicio("2023-01-01"); setFechaFin("2023-12-31"); setSelectedBlocks([]); setSelectedTypes([]); setPage(1); }}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors underline">
              Limpiar todos los filtros
            </button>
          </div>

          {stats && (
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: "Registros filtrados", value: stats.count.toLocaleString("es-CO"), accent: "text-white" },
                { label: "Promedio", value: stats.avg.toFixed(2), accent: "text-cyan-400" },
                { label: "Mínimo", value: stats.min.toFixed(2), accent: "text-blue-400" },
                { label: "Máximo", value: stats.max.toFixed(2), accent: "text-orange-400" },
              ].map((s) => (
                <div key={s.label} className="bg-[#0d1220] border border-slate-800 rounded-xl p-4">
                  <div className="text-xs text-slate-500 mb-1">{s.label}</div>
                  <div className={`text-xl font-bold tabular-nums ${s.accent}`}>{s.value}</div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-[#0d1220] border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Mostrando {filteredData.length === 0 ? 0 : ((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filteredData.length)} de{" "}
                <span className="text-white font-semibold">{filteredData.length.toLocaleString("es-CO")}</span> registros
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 bg-slate-800 rounded-lg disabled:opacity-30 hover:bg-slate-700 transition-colors">← Prev</button>
                <span className="text-slate-400">{page} / {totalPages || 1}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="px-3 py-1.5 bg-slate-800 rounded-lg disabled:opacity-30 hover:bg-slate-700 transition-colors">Next →</button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-800/50">
                    {["id_sensor","data_type","data_value","data_date","block_name"].map((h) => (
                      <th key={h} className="px-4 py-3 text-left text-slate-400 font-semibold tracking-wider uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginated.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">No hay registros para los filtros seleccionados</td></tr>
                  ) : paginated.map((r, i) => (
                    <tr key={i} className="border-t border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                      <td className="px-4 py-2.5 text-slate-500">{r.id_sensor}</td>
                      <td className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded border text-xs font-semibold ${typeColors[r.data_type] || "bg-slate-700 text-slate-300 border-slate-600"}`}>
                          {r.data_type}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-white">{parseFloat(r.data_value).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-slate-300">{r.data_date}</td>
                      <td className="px-4 py-2.5">
                        <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-300 border border-slate-700">{r.block_name}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}