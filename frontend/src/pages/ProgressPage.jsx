import React, { useCallback, useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import Loader from "@/components/Loader";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import { ChartLineUp, Trophy, Target, Books } from "@phosphor-icons/react";
import { toast } from "sonner";

const StatCard = ({ icon: Icon, label, value, unit = "%", accent = "bg-lavender", testid }) => (
  <div className="brut-card p-5 flex items-center gap-4" data-testid={testid}>
    <span className={`h-11 w-11 flex items-center justify-center border-2 border-ink rounded-md ${accent}`}>
      <Icon size={20} weight="duotone" />
    </span>
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-ink/60">{label}</p>
      <p className="font-heading text-2xl font-black">{value}{unit && <span className="text-base font-bold">{unit}</span>}</p>
    </div>
  </div>
);

const ProgressPage = () => {
  const [data, setData] = useState(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get("/progress");
      setData(data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!data) return <Loader />;

  const series = data.series.map((s, i) => ({
    index: i + 1,
    percent: s.percent,
    date: new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
  }));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="progress-page">
      <span className="brut-badge bg-lavender mb-3">
        <ChartLineUp size={12} weight="fill" /> Progress Tracker
      </span>
      <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight">
        Your learning curve.
      </h1>
      <p className="mt-2 text-ink/70 max-w-xl">
        Every quiz you take is plotted below. Aim for the 80% line — consistent wins beat cramming.
      </p>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Target} label="Attempts" value={data.attempts} unit="" accent="bg-sun" testid="stat-attempts" />
        <StatCard icon={ChartLineUp} label="Average" value={data.average} accent="bg-lavender" testid="stat-average" />
        <StatCard icon={Trophy} label="Best" value={data.best} accent="bg-mint" testid="stat-best" />
        <StatCard icon={Books} label="Last" value={data.last} accent="bg-coral" testid="stat-last" />
      </div>

      <div className="mt-8 brut-card p-4 sm:p-6">
        <h2 className="font-heading text-xl font-bold">Score over time</h2>
        {series.length === 0 ? (
          <p className="mt-4 text-ink/60">Take your first quiz to see a trend line here.</p>
        ) : (
          <div className="h-80 mt-4" data-testid="progress-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 20, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid stroke="#09090B22" strokeDasharray="4 4" />
                <XAxis dataKey="date" tick={{ fontFamily: "Outfit", fill: "#09090B", fontWeight: 700 }} />
                <YAxis domain={[0, 100]} tick={{ fontFamily: "Outfit", fill: "#09090B", fontWeight: 700 }} />
                <Tooltip
                  contentStyle={{ border: "2px solid #09090B", borderRadius: 8, boxShadow: "4px 4px 0 #09090B" }}
                  formatter={(v) => [`${v}%`, "Score"]}
                />
                <ReferenceLine y={80} stroke="#A7F3D0" strokeWidth={3} strokeDasharray="6 6"
                  label={{ value: "Goal 80%", position: "insideTopRight", fontFamily: "Outfit", fontWeight: 700 }} />
                <Line type="monotone" dataKey="percent" stroke="#7C6DFF" strokeWidth={3}
                  dot={{ r: 5, fill: "#FDE047", stroke: "#09090B", strokeWidth: 2 }}
                  activeDot={{ r: 7, fill: "#A7F3D0", stroke: "#09090B", strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {data.by_document.length > 0 && (
        <div className="mt-10">
          <h2 className="font-heading text-xl font-bold">By document</h2>
          <div className="mt-4 brut-card overflow-hidden">
            <table className="w-full text-sm" data-testid="by-doc-table">
              <thead className="bg-lavender border-b-2 border-ink">
                <tr className="text-left font-heading font-bold">
                  <th className="p-3">Document</th>
                  <th className="p-3">Attempts</th>
                  <th className="p-3">Average</th>
                  <th className="p-3">Best</th>
                </tr>
              </thead>
              <tbody>
                {data.by_document.map((d) => (
                  <tr key={d.document_id} className="border-t-2 border-ink/10">
                    <td className="p-3 font-bold">{d.title}</td>
                    <td className="p-3">{d.attempts}</td>
                    <td className="p-3">{d.average}%</td>
                    <td className="p-3">{d.best}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressPage;
