// 회원가입 페이지 - 역할별 항목 (공급업체: 중국어, 바이어: 한국어)
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { REGIONS } from "@/utils/regions";

export default function SignupPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [role, setRole] = useState<"supplier" | "buyer">("supplier");
  const [regionCode, setRegionCode] = useState("");

  // 공급업체 추가 필드
  const [contactPerson, setContactPerson] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [wechatId, setWechatId] = useState("");

  // 바이어 추가 필드
  const [buyerName, setBuyerName] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [department, setDepartment] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    if (role === "supplier" && !regionCode) {
      setError("请选择地区");
      setLoading(false);
      return;
    }
    if (role === "supplier" && !contactPerson.trim()) {
      setError("请输入联系人姓名");
      setLoading(false);
      return;
    }
    if (role === "supplier" && !supplierPhone.trim()) {
      setError("请输入电话号码");
      setLoading(false);
      return;
    }
    if (role === "buyer" && !buyerName.trim()) {
      setError("이름을 입력해주세요.");
      setLoading(false);
      return;
    }
    if (role === "buyer" && !buyerPhone.trim()) {
      setError("전화번호를 입력해주세요.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          companyName,
          role,
          regionCode: role === "supplier" ? regionCode : undefined,
          name: role === "supplier" ? contactPerson : buyerName,
          phone: role === "supplier" ? supplierPhone : buyerPhone,
          wechatId: role === "supplier" ? wechatId : undefined,
          department: role === "buyer" ? department : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error); setLoading(false); return; }

      if (role === "buyer") {
        setSuccess("회원가입 완료! 관리자 승인 후 이용 가능합니다. 승인 대기중입니다.");
      } else {
        setSuccess(data.message);
      }
      setLoading(false);
      setTimeout(() => router.push("/login"), 3000);
    } catch {
      setError(role === "supplier" ? "服务器连接失败，请重试。" : "서버 연결에 실패했습니다.");
      setLoading(false);
    }
  };

  const isSupplier = role === "supplier";

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-8">
          {isSupplier ? "供应商注册" : "회원가입"}
        </h1>

        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 text-center">
            <p className="font-semibold">{success}</p>
            <p className="text-sm mt-1">{isSupplier ? "3秒后跳转到登录页..." : "3초 후 로그인 페이지로 이동합니다..."}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-center">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* 역할 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isSupplier ? "角色" : "역할"}
            </label>
            <select value={role} onChange={(e) => setRole(e.target.value as "supplier" | "buyer")}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
              <option value="supplier">供应商 (공급업체)</option>
              <option value="buyer">买家 (바이어)</option>
            </select>
          </div>

          {/* 이메일 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isSupplier ? "邮箱" : "이메일"}
            </label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder={isSupplier ? "请输入邮箱" : "이메일을 입력하세요"} required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* 비밀번호 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isSupplier ? "密码" : "비밀번호"}
            </label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={isSupplier ? "请输入密码（至少6位）" : "비밀번호 (6자 이상)"} required minLength={6}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* 회사명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {isSupplier ? "公司名称" : "회사명"}
            </label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)}
              placeholder={isSupplier ? "请输入公司名称" : "회사명을 입력하세요"} required
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* ===== 공급업체 전용 필드 ===== */}
          {isSupplier && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">地区 <span className="text-red-500">*</span></label>
                <select value={regionCode} onChange={(e) => setRegionCode(e.target.value)} required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500">
                  <option value="">请选择地区</option>
                  {REGIONS.map((r) => <option key={r.code} value={r.code}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">联系人姓名 <span className="text-red-500">*</span></label>
                <input type="text" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)}
                  placeholder="请输入联系人姓名" required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">电话号码 <span className="text-red-500">*</span></label>
                <input type="tel" value={supplierPhone} onChange={(e) => setSupplierPhone(e.target.value)}
                  placeholder="请输入电话号码" required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">微信ID (选填)</label>
                <input type="text" value={wechatId} onChange={(e) => setWechatId(e.target.value)}
                  placeholder="请输入微信ID"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          {/* ===== 바이어 전용 필드 ===== */}
          {!isSupplier && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름 <span className="text-red-500">*</span></label>
                <input type="text" value={buyerName} onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="이름을 입력하세요" required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">전화번호 <span className="text-red-500">*</span></label>
                <input type="tel" value={buyerPhone} onChange={(e) => setBuyerPhone(e.target.value)}
                  placeholder="전화번호를 입력하세요" required
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">부서 (선택)</label>
                <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)}
                  placeholder="부서를 입력하세요"
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500" />
              </div>
            </>
          )}

          <button type="submit" disabled={loading || !!success}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 mt-2 disabled:bg-gray-400">
            {loading ? (isSupplier ? "注册中..." : "가입 중...") : (isSupplier ? "注册" : "회원가입")}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-6">
          {isSupplier ? "已有账号？" : "이미 계정이 있으신가요?"}{" "}
          <Link href="/login" className="text-blue-600 hover:underline">
            {isSupplier ? "登录" : "로그인"}
          </Link>
        </p>
      </div>
    </div>
  );
}
