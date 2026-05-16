"use client";

import { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";

interface SensorRecord {
  id_sensor: number;
  data_type: string;
  data_value: number;
  data_date: string;
  block_name: string;
}

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

function parseExcel(buffer: ArrayBuffer): SensorRecord[] {
  const wb = XLSX.read(buffer, { type: "array" });
  const ws = wb.Sheets["Datos"];
  if (!ws) throw new Error("Hoja 'Datos' no encontrada");

  // Leer como array de arrays (raw, sin headers)
  const raw = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });

  const row0 = raw[0] as (string | null)[]; // block_names
  const row2 = raw[2] as (string | null)[]; // data_types

  const validTypes = new Set(["RHUM", "PURO", "RASO", "TEMP"]);

  // Construir mapa de columnas válidas
  const cols: { idx: number; block: string; data_type: string }[] = [];
  for (let i = 2; i < row0.length; i++) {
    const block = row0[i];
    const dtype = row2[i];
    if (block && dtype && validTypes.has(String(dtype))) {
      cols.push({ idx: i, block: String(block), data_type: String(dtype) });
    }
  }

  const records: SensorRecord[] = [];

  // Filas de datos desde fila índice 3
  for (let r = 3; r < raw.length; r++) {
    const row = raw[r] as (string | number | null)[];
    const fecha = row[0];
    const hora = row[1];
    if (fecha == null || hora == null) continue;

    // Normalizar fecha
    let fechaStr = "";
    if (typeof fecha === "number") {
      // Excel serial date
      const d = XLSX.SSF.parse_date_code(fecha);
      fechaStr = `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
    } else {
      fechaStr = String(fecha).substring(0, 10);
    }

    // Normalizar hora
    let horaStr = "";
    if (typeof hora === "number") {
      const totalMin = Math.round(hora * 24 * 60);
      const h = Math.floor(totalMin / 60);
      const m = totalMin % 60;
      horaStr = `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`;
    } else {
      const parts = String(hora).split(":");
      horaStr = `${parts[0].padStart(2,"0")}:${(parts[1]||"00").padStart(2,"0")}:00`;
    }

    const data_date = `${fechaStr} ${horaStr}`;

    for (const c of cols) {
      const val = row[c.idx];
      let data_value = 0;
      if (val !== null && val !== undefined && val !== "") {
        const n = parseFloat(String(val));
        data_value = isNaN(n) ? 0 : n;
      }
      records.push({
        id_sensor: 0,
        data_type: c.data_type,
        data_value,
        data_date,
        block_name: c.block,
      });
    }
  }

  return records;
}

export default function Home() {
  const [allData, setAllData] = useState<SensorRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");

  const [fechaInicio, setFechaInicio] = useState("2023-01-01");
  const [fechaFin, setFechaFin] = useState("2023-12-31");
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [page, setPage] = useState(1);

  const allBlocks = useMemo(() => {
    const s = new Set(allData.map((r) => r.block_name));
    return Array.from(s).sort();
  }, [allData]);

  const allTypes = useMemo(() => {
    const s = new Set(allData.map((r) => r.data_type));
    return Array.from(s).sort();
  }, [allData]);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setLoading(true);
    setLoaded(false);
    setError("");
    setAllData([]);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const records = parseExcel(buffer);
        setAllData(records);
        setLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error al procesar el archivo");
      } finally {
        setLoading(false);
      }
    };
    reader.onerror = () => {
      setError("Error al leer el archivo");
      setLoading(false);
    };
    reader.readAsArrayBuffer(file);
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
    const vals = filteredData.map((r) => r.data_value);
    const sum = vals.reduce((a, b) => a + b, 0);
    return { count: filteredData.length, avg: sum / vals.length, min: Math.min(...vals), max: Math.max(...vals) };
  }, [filteredData]);

  return (
    <main className="min-h-screen bg-[#0a0e1a] text-slate-100 font-mono">
      {/* Header */}
      <div className="border-b border-slate-800 bg-[#0d1220]">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              <span className="text-cyan-400">dept</span>maintenance
              <span className="text-slate-500 text-sm ml-3 font-normal">/ sensor dashboard</span>
            </h1>
            <p className="text-slate-500 text-xs mt-1">tbl_sensors_data_temp — BI Parcial Final</p>
          </div>
          {loaded && (
            <div className="text-right">
              <div className="text-xs text-slate-500">registros cargados</div>
              <div className="text-2xl font-bold text-cyan-400 tabular-nums">
                {allData.length.toLocaleString("es-CO")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Upload */}
      {!loaded && !loading && (
        <div className="max-w-xl mx-auto px-6 py-20 flex flex-col items-center gap-6">
          <div className="text-center space-y-2">
            <div className="text-4xl">📊</div>
            <h2 className="text-lg font-semibold text-white">Cargar archivo Excel</h2>
            <p className="text-slate-400 text-sm">
              Selecciona el archivo <span className="text-cyan-400">ParcialFinal_BI.xlsx</span>
            </p>
          </div>
          {error && (
            <div className="w-full bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm">
              {error}
            </div>
          )}
          <label className="cursor-pointer w-full">
            <div className="border-2 border-dashed border-slate-700 hover:border-cyan-500 rounded-xl p-10 text-center transition-colors group">
              <p className="text-slate-500 group-hover:text-slate-300 text-sm transition-colors">
                Haz clic para seleccionar el archivo
              </p>
              <p className="text-slate-600 text-xs mt-1">.xlsx</p>
            </div>
            <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
          </label>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="max-w-7xl mx-auto px-6 py-20 flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">
            Procesando <span className="text-white">{fileName}</span>...
          </p>
          <p className="text-slate-600 text-xs">Esto puede tomar unos segundos</p>
        </div>
      )}

      {/* Dashboard */}
      {loaded && (
        <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
          {/* Filters */}
          <div className="bg-[#0d1220] border border-slate-800 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs uppercase tracking-widest text-slate-500 font-semibold">Filtros</h2>
              <label className="cursor-pointer text-xs text-cyan-400 hover:text-cyan-300 transition-colors underline">
                Cargar otro archivo
                <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
              </label>
            </div>

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
                {allTypes.map((t) => (
                  <button key={t} onClick={() => toggleType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                      selectedTypes.includes(t)
                        ? (typeActiveBg[t] || "bg-slate-500 text-white border-slate-400")
                        : "bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-500"
                    }`}>
                    {t}
                    {DATA_TYPE_LABELS[t] && (
                      <span className="opacity-60 font-normal"> — {DATA_TYPE_LABELS[t]}</span>
                    )}
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
                {allBlocks.map((b) => (
                  <button key={b} onClick={() => toggleBlock(b)}
                    className={`px-2.5 py-1 rounded-md text-xs font-mono border transition-all ${
                      selectedBlocks.includes(b)
                        ? "bg-cyan-500 text-white border-cyan-400"
                        : "bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-500"
                    }`}>
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

          {/* Stats */}
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

          {/* Table */}
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
                      <td className="px-4 py-2.5 tabular-nums text-white">{r.data_value.toFixed(2)}</td>
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