// 관리자 - 회원 관리 (등급 시스템)
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

interface User {
  id: string;
  email: string;
  role: string;
  company_name: string;
  member_code: string | null;
  can_view_price: boolean;
  is_approved: boolean;
  is_active: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [adminId, setAdminId] = useState<string | null>(null);
  const [myRole, setMyRole] = useState("");
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setAdminId(session.user.id);

      // 서버 API로 역할 확인 (RLS 우회)
      try {
        const meRes = await fetch("/api/auth/ensure-user", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: session.user.id }),
        });
        const meData = await meRes.json();
        setMyRole(meData.role || "");
      } catch {
        const { data: me } = await supabase.from("users").select("role").eq("id", session.user.id).single();
        setMyRole(me?.role || "");
      }

      const res = await fetch(`/api/admin?user_id=${session.user.id}`);
      const data = await res.json();
      if (data.error) { router.push("/login"); return; }
      setUsers(data.users || []);
      setLoading(false);
    };
    init();
  }, [router]);

  const updateUser = async (userId: string, updates: Record<string, unknown>) => {
    if (!adminId) return;
    setUpdating(userId);
    try {
      const res = await fetch("/api/admin", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ admin_id: adminId, target_user_id: userId, ...updates }),
      });
      const data = await res.json();
      if (data.success) {
        setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, ...updates } as User : u));
      }
    } catch { /* */ }
    setUpdating(null);
  };

  const deleteUser = async (userId: string, userEmail: string) => {
    if (!adminId) return;
    if (!confirm(`정말 ${userEmail} 회원을 강제 탈퇴시키겠습니까?\n\n이 작업은 되돌릴 수 없습니다. 해당 회원의 모든 데이터가 삭제됩니다.`)) return;
    setDeleting(userId);
    try {
      const res = await fetch(`/api/admin?admin_id=${adminId}&target_id=${userId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert("탈퇴 처리되었습니다.");
        setUsers((prev) => prev.filter((u) => u.id !== userId));
      } else {
        alert(data.error || "탈퇴 실패");
      }
    } catch { alert("서버 오류"); }
    setDeleting(null);
  };

  const roleLabel = (role: string) => {
    switch (role) {
      case "super_admin": return "슈퍼관리자";
      case "admin": return "관리자";
      case "super_buyer": return "슈퍼바이어";
      case "buyer": return "바이어";
      case "supplier": return "공급업체";
      default: return role;
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case "super_admin": return "bg-red-100 text-red-700";
      case "admin": return "bg-orange-100 text-orange-700";
      case "super_buyer": return "bg-purple-100 text-purple-700";
      case "buyer": return "bg-blue-100 text-blue-700";
      case "supplier": return "bg-green-100 text-green-700";
      default: return "bg-gray-100 text-gray-700";
    }
  };

  const isSuperAdmin = myRole === "super_admin";
  const isNormalAdmin = myRole === "admin";
  const [activeTab, setActiveTab] = useState<"all" | "buyer" | "supplier" | "admin">("all");

  // 탭별 필터링 + 미승인 바이어 상단
  const filtered = users.filter((u) => {
    if (activeTab === "buyer") return u.role === "buyer" || u.role === "super_buyer";
    if (activeTab === "supplier") return u.role === "supplier";
    if (activeTab === "admin") return u.role === "admin" || u.role === "super_admin";
    return true;
  });
  // 일반 admin은 바이어만 표시
  const displayUsers = isNormalAdmin ? filtered.filter((u) => u.role === "buyer" || u.role === "super_buyer") : filtered;
  const sorted = [...displayUsers].sort((a, b) => {
    if (!a.is_approved && a.role === "buyer") return -1;
    if (!b.is_approved && b.role === "buyer") return 1;
    return 0;
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-800">회원 관리</h2>
          <button onClick={() => router.push("/admin")} className="px-4 py-2 text-sm text-gray-600 border rounded-lg hover:bg-gray-100">대시보드</button>
        </div>

        {loading && <div className="text-center py-20 text-gray-500">로딩 중...</div>}

        {/* 탭 (super_admin만) */}
        {!loading && isSuperAdmin && (
          <div className="flex gap-2 mb-4 border-b">
            {[
              { key: "all" as const, label: "전체" },
              { key: "buyer" as const, label: "바이어" },
              { key: "supplier" as const, label: "공급업체" },
              { key: "admin" as const, label: "관리자" },
            ].map((tab) => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.key ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        )}

        {!loading && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">회원번호</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">이메일</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-600">회사명</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">등급</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">승인</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">단가 열람</th>
                    {isSuperAdmin && <th className="text-center px-4 py-3 font-medium text-gray-600">등급 변경</th>}
                    <th className="text-left px-4 py-3 font-medium text-gray-600">가입일</th>
                    <th className="text-center px-4 py-3 font-medium text-gray-600">관리</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {sorted.map((user) => (
                    <tr key={user.id} className={`hover:bg-gray-50 ${!user.is_approved && user.role === "buyer" ? "bg-yellow-50" : ""}`}>
                      <td className="px-4 py-3 font-mono text-blue-600">{user.member_code || "-"}</td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">{user.company_name}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${roleColor(user.role)}`}>
                          {roleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {user.role === "buyer" ? (
                          <button
                            onClick={() => updateUser(user.id, { is_approved: !user.is_approved })}
                            disabled={updating === user.id}
                            className={`px-2 py-1 rounded text-xs font-medium ${
                              user.is_approved ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700 animate-pulse"
                            }`}
                          >
                            {user.is_approved ? "승인됨" : "승인 대기 → 클릭"}
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">자동승인</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {user.role === "buyer" ? (
                          <button
                            onClick={() => updateUser(user.id, { can_view_price: !user.can_view_price })}
                            disabled={updating === user.id}
                            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                              user.can_view_price ? "bg-blue-600" : "bg-gray-300"
                            }`}
                          >
                            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                              user.can_view_price ? "translate-x-4" : "translate-x-0.5"
                            }`} />
                          </button>
                        ) : (
                          <span className="text-xs text-gray-400">
                            {["super_admin", "super_buyer", "supplier"].includes(user.role) ? "가능" : "불가"}
                          </span>
                        )}
                      </td>
                      {isSuperAdmin && (
                        <td className="px-4 py-3 text-center">
                          {user.id === adminId ? (
                            <span className="text-xs text-gray-400">본인</span>
                          ) : user.role === "supplier" ? (
                            <span className="text-xs text-gray-400">-</span>
                          ) : (
                            <select
                              value={user.role}
                              onChange={(e) => updateUser(user.id, { role: e.target.value })}
                              className="text-xs border rounded px-1 py-0.5"
                              disabled={updating === user.id}
                            >
                              <option value="buyer">바이어</option>
                              <option value="super_buyer">슈퍼바이어</option>
                              <option value="admin">관리자</option>
                            </select>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-gray-500">{new Date(user.created_at).toLocaleDateString("ko-KR")}</td>
                      <td className="px-4 py-3 text-center">
                        {user.id !== adminId && (
                          // super_admin: 모든 회원 탈퇴 가능 / admin: buyer만
                          (isSuperAdmin || (isNormalAdmin && user.role === "buyer")) && (
                            <button
                              onClick={() => deleteUser(user.id, user.email)}
                              disabled={deleting === user.id}
                              className="px-2 py-1 text-xs text-red-600 border border-red-300 rounded hover:bg-red-50 disabled:opacity-50"
                            >
                              {deleting === user.id ? "처리중..." : "강제 탈퇴"}
                            </button>
                          )
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
