import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface ChartDatum {
  name: string;
  value: number;
  color: string;
}

interface MetricsChartProps {
  title: string;
  data: ChartDatum[];
  emptyMessage?: string;
}

export function MetricsChart({ title, data, emptyMessage = "No data yet" }: MetricsChartProps) {
  const hasData = data.some((datum) => datum.value > 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-4 h-56 w-full">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "#f1f5f9" }} />
              <Bar dataKey="value" name="Count" radius={[6, 6, 0, 0]}>
                {data.map((datum) => (
                  <Cell key={datum.name} fill={datum.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">{emptyMessage}</div>
        )}
      </div>
    </section>
  );
}
