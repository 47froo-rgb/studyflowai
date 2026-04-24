import React, { useCallback, useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import Loader from "@/components/Loader";
import { Users, FileText, CheckCircle, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";

const Metric = ({ icon: Icon, label, value, accent }) => (
  <div className="brut-card p-5 flex items-center gap-4">
    <span className={`h-11 w-11 flex items-center justify-center border-2 border-ink rounded-md ${accent}`}>
      <Icon size={20} weight="duotone" />
    </span>
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-ink/60">{label}</p>
      <p className="font-heading text-2xl font-black">{value}</p>
    </div>
  </div>
);

const AdminPage = () => {
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState(null);

  const load = useCallback(async () => {
    try {
      const [s, u] = await Promise.all([api.get("/admin/stats"), api.get("/admin/users")]);
      setStats(s.data);
      setUsers(u.data);
    } catch (e) {
      toast.error(formatApiErrorDetail(e.response?.data?.detail));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!stats || !users) return <Loader />;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10" data-testid="admin-page">
      <span className="brut-badge bg-sun mb-3"><Sparkle size={12} weight="fill" /> Admin</span>
      <h1 className="font-heading text-4xl sm:text-5xl font-black tracking-tight">
        Platform overview.
      </h1>
      <p className="mt-2 text-ink/70">All-time usage and user activity across StudyFlow AI.</p>

      <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
        <Metric icon={Users} label="Students" value={stats.students_total} accent="bg-lavender" />
        <Metric icon={FileText} label="Documents" value={stats.documents_total} accent="bg-mint" />
        <Metric icon={CheckCircle} label="Ready" value={stats.documents_ready} accent="bg-sun" />
        <Metric icon={Sparkle} label="Quiz attempts" value={stats.attempts_total} accent="bg-coral" />
      </div>

      <div className="mt-10">
        <h2 className="font-heading text-xl font-bold">Users</h2>
        <div className="mt-4 brut-card overflow-hidden">
          <table className="w-full text-sm" data-testid="admin-users-table">
            <thead className="bg-lavender border-b-2 border-ink">
              <tr className="text-left font-heading font-bold">
                <th className="p-3">Name</th>
                <th className="p-3">Email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Documents</th>
                <th className="p-3">Quiz attempts</th>
                <th className="p-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t-2 border-ink/10" data-testid={`admin-user-${u.id}`}>
                  <td className="p-3 font-bold">{u.name}</td>
                  <td className="p-3">{u.email}</td>
                  <td className="p-3">
                    <span className={`brut-tag ${u.role === "admin" ? "bg-sun" : "bg-mint"}`}>{u.role}</span>
                  </td>
                  <td className="p-3">{u.document_count}</td>
                  <td className="p-3">{u.attempts}</td>
                  <td className="p-3">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
