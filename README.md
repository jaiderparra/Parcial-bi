# Parcial Final BI — Sensor Dashboard

Interfaz Next.js para visualizar y filtrar los datos del Excel `ParcialFinal_BI.xlsx`, mapeados a la estructura de `tbl_sensors_data_temp`.

## ¿Qué hace?

- **Parsea** el Excel (Fecha + Hora → `data_date`, nombre de columna → `block_name`, fila de tipos → `data_type`)
- **Carga** 227.771 registros directamente en el browser desde `sensor_data.csv`
- **Filtra** por `fecha_inicio`, `fecha_fin`, `block_name` y `data_type` en tiempo real
- **Paginación** de 50 registros por página con estadísticas (promedio, mín, máx)

## Cómo correr localmente

```bash
npm install
npm run dev
```

Abrir http://localhost:3000

## Desplegar en Vercel

```bash
npm install -g vercel
vercel
```

O conectar el repo en https://vercel.com/new

## Estructura del Excel → tabla

| Excel | Campo SQL |
|-------|-----------|
| Fila 1 col 0 (ej: `AG10`) | `block_name` |
| Fila 2 col 0 (ej: `RHUM`) | `data_type` |
| `Fecha` + `Hora` | `data_date` |
| Valor numérico | `data_value` |

## data_types

- `RHUM` — Humedad relativa (%)
- `TEMP` — Temperatura (°C)
- `PURO` — Punto de Rocío (°C)
- `RASO` — Radiación PAR (µmol m⁻² s⁻¹)