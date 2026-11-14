import { MONTH_NAMES } from "@/lib/finance";

type Defaults = { school?: string; name?: string; year?: number; monthlyFee?: number; startMonth?: number; endMonth?: number };

/** Campos compartidos entre crear y editar un curso. */
export default function CourseFields({ d = {} }: { d?: Defaults }) {
  const year = d.year ?? new Date().getFullYear();
  return (
    <>
      <div>
        <label className="label" htmlFor="school">Colegio</label>
        <input id="school" name="school" className="input" required defaultValue={d.school} placeholder="Ej: Colegio San Ignacio" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Curso</label>
          <input id="name" name="name" className="input" required defaultValue={d.name} placeholder="Ej: 3° Básico A" />
        </div>
        <div>
          <label className="label" htmlFor="year">Año escolar</label>
          <input id="year" name="year" type="number" className="input" required min={2020} max={2100} defaultValue={year} />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="monthlyFee">Cuota mensual (CLP)</label>
        <input id="monthlyFee" name="monthlyFee" type="number" min={0} step={1} className="input" required defaultValue={d.monthlyFee ?? 5000} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="startMonth">Primer mes de cobro</label>
          <select id="startMonth" name="startMonth" className="input" defaultValue={d.startMonth ?? 3}>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="endMonth">Último mes de cobro</label>
          <select id="endMonth" name="endMonth" className="input" defaultValue={d.endMonth ?? 12}>
            {MONTH_NAMES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
          </select>
        </div>
      </div>
    </>
  );
}
