// 마이페이지 - 바이어/관리자(한국어) + 공급업체(중국어)
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Header from "@/components/Header";

export default function MyPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [wechatId, setWechatId] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const isSupplier = role === "supplier";

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push("/login"); return; }
      setUserId(session.user.id);

      const res = await fetch(`/api/mypage?user_id=${session.user.id}`);
      const data = await res.json();
      if (data.user) {
        setRole(data.user.role || "");
        setName(data.user.name || "");
        setPhone(data.user.phone || "");
        setDepartment(data.user.department || "");
        setWechatId(data.user.wechat_id || "");
      }
      setLoading(false);
    };
    init();
  }, [router]);

  const handleSave = async () => {
    if (newPassword && newPassword !== confirmPassword) {
      setMessage(isSupplier ? "密码不一致" : "비밀번호가 일치하지 않습니다.");
      return;
    }
    if (newPassword && newPassword.length < 6) {
      setMessage(isSupplier ? "密码至少6位" : "비밀번호는 6자 이상이어야 합니다.");
      return;
    }

    setSaving(true);
    setMessage("");
    const res = await fetch("/api/mypage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId, name, phone, department, wechat_id: wechatId,
        new_password: newPassword || undefined,
      }),
    });
    const data = await res.json();
    if (data.success) {
      setMessage(isSupplier ? "保存成功！" : "저장되었습니다!");
      setNewPassword("");
      setConfirmPassword("");
    } else {
      setMessage(isSupplier ? "保存失败" : "저장 실패");
    }
    setSaving(false);
  };

  if (loading) return <div className="min-h-screen bg-gray-50"><Header /><div className="text-center py-20 text-gray-500">{isSupplier ? "加载中..." : "로딩 중..."}</div></div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-lg mx-auto px-4 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">
          {isSupplier ? "个人信息" : "마이페이지"}
        </h2>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes("성공") || message.includes("成功") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
            {message}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border p-6 space-y-5">
          {/* 이름/담당자 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isSupplier ? "联系人" : "이름"}
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg" />
          </div>

          {/* 전화번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isSupplier ? "电话" : "전화번호"}
            </label>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2 border rounded-lg" />
          </div>

          {/* 부서 (바이어만) */}
          {!isSupplier && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">부서</label>
              <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg" />
            </div>
          )}

          {/* 위챗 (공급업체만) */}
          {isSupplier && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">微信号</label>
              <input type="text" value={wechatId} onChange={(e) => setWechatId(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg" />
            </div>
          )}

          {/* 비밀번호 변경 */}
          <div className="border-t pt-5">
            <h3 className="text-sm font-bold text-gray-800 mb-3">
              {isSupplier ? "修改密码" : "비밀번호 변경"}
            </h3>
            <div className="space-y-3">
              <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                placeholder={isSupplier ? "新密码（至少6位）" : "새 비밀번호 (6자 이상)"}
                className="w-full px-4 py-2 border rounded-lg" />
              <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={isSupplier ? "确认新密码" : "비밀번호 확인"}
                className="w-full px-4 py-2 border rounded-lg" />
            </div>
          </div>

          <button onClick={handleSave} disabled={saving}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:bg-gray-400">
            {saving ? (isSupplier ? "保存中..." : "저장 중...") : (isSupplier ? "保存" : "저장")}
          </button>
        </div>
      </main>
    </div>
  );
}
