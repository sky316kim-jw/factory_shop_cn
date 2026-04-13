// 상품별 소통 댓글 - 언어별 표시 + 삭제/신고
"use client";

import { useEffect, useState, useRef } from "react";

interface Comment {
  id: string;
  message: string;
  translated_message: string | null;
  language: string;
  is_deleted: boolean;
  is_reported: boolean;
  created_at: string;
  user_id: string;
  users: { email: string; role: string; member_code: string | null; company_name: string };
}

interface Props {
  productId: string;
  userId: string;
  viewerRole?: string; // 보는 사람의 역할
}

export default function ProductComments({ productId, userId, viewerRole }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [blockedMsg, setBlockedMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [myRole, setMyRole] = useState(viewerRole || "");
  // 댓글 수정 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  // 스크롤 제어: 사용자가 직접 댓글 작성 시에만 자동 스크롤
  const shouldScrollRef = useRef(false);

  // 공급업체가 보면 중국어, 아니면 한국어
  const isSupplierView = myRole === "supplier";

  const loadComments = async () => {
    const res = await fetch(`/api/comments?product_id=${productId}`);
    const data = await res.json();
    setComments(data.comments || []);
    setLoading(false);
  };

  useEffect(() => {
    // 본인 역할 확인
    if (!viewerRole) {
      fetch(`/api/auth/ensure-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      }).then(r => r.json()).then(d => { if (d.role) setMyRole(d.role); });
    }
    loadComments();
    const interval = setInterval(loadComments, 30000);
    return () => clearInterval(interval);
  }, [productId]);

  // 사용자가 직접 댓글을 보낼 때만 하단으로 스크롤 (자동 새로고침 시에는 스크롤 안 함)
  useEffect(() => {
    if (shouldScrollRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
      shouldScrollRef.current = false;
    }
  }, [comments]);

  const handleSend = async () => {
    if (!newMsg.trim() || sending) return;
    setSending(true);
    setBlockedMsg(null);
    try {
      const res = await fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, user_id: userId, message: newMsg.trim() }),
      });
      const data = await res.json();
      if (data.blocked) {
        setBlockedMsg(isSupplierView ? data.message_zh : data.message_ko);
      } else if (data.success && data.comment) {
        shouldScrollRef.current = true; // 본인 댓글 전송 시에만 스크롤
        setComments((prev) => [...prev, data.comment]);
        setNewMsg("");
      }
    } catch { /* */ }
    setSending(false);
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm(isSupplierView ? "确定要删除此留言吗？" : "이 댓글을 삭제하시겠습니까?")) return;
    const res = await fetch("/api/comments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment_id: commentId, action: "delete", user_id: userId }),
    });
    const data = await res.json();
    if (data.success) loadComments();
    else alert(data.error);
  };

  // 댓글 수정 처리
  const handleEdit = async (commentId: string) => {
    if (!editMsg.trim()) return;
    const res = await fetch("/api/comments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment_id: commentId, action: "edit", user_id: userId, message: editMsg.trim() }),
    });
    const data = await res.json();
    if (data.success) { setEditingId(null); setEditMsg(""); loadComments(); }
    else alert(data.error);
  };

  const handleReport = async (commentId: string) => {
    if (!confirm(isSupplierView ? "确定要举报此留言吗？" : "이 댓글을 신고하시겠습니까?")) return;
    await fetch("/api/comments", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment_id: commentId, action: "report", user_id: userId }),
    });
    alert(isSupplierView ? "已举报" : "신고되었습니다.");
    loadComments();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // 역할 배지
  const roleBadge = (role: string) => {
    if (isSupplierView) {
      switch (role) {
        case "buyer": case "super_buyer": return <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">买家</span>;
        case "supplier": return <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">供应商</span>;
        case "admin": case "super_admin": return <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">管理员</span>;
        default: return null;
      }
    }
    switch (role) {
      case "buyer": return <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">바이어</span>;
      case "super_buyer": return <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">슈퍼바이어</span>;
      case "supplier": return <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded">공급업체</span>;
      case "admin": return <span className="text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">관리자</span>;
      case "super_admin": return <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">슈퍼관리자</span>;
      default: return null;
    }
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (mins < 1) return isSupplierView ? "刚才" : "방금";
    if (mins < 60) return isSupplierView ? `${mins}分钟前` : `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return isSupplierView ? `${hours}小时前` : `${hours}시간 전`;
    return d.toLocaleDateString(isSupplierView ? "zh-CN" : "ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const isSuperAdmin = myRole === "super_admin";

  return (
    <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b">
        <h3 className="font-bold text-gray-800 text-sm">
          {isSupplierView ? "沟通留言" : "소통 댓글"}
        </h3>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {isSupplierView
            ? "此频道仅限生产/交期相关沟通，不允许询价及交换联系方式"
            : "생산/납기 관련 소통만 가능합니다. 단가 및 연락처 교환 불가"}
        </p>
      </div>

      {/* 댓글 목록 */}
      <div className="max-h-80 overflow-y-auto p-4 space-y-3">
        {loading && <p className="text-center text-gray-400 text-sm py-4">{isSupplierView ? "加载中..." : "로딩 중..."}</p>}
        {!loading && comments.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-4">{isSupplierView ? "暂无留言" : "아직 댓글이 없습니다"}</p>
        )}

        {comments.map((c) => {
          const isMe = c.user_id === userId;
          const user = c.users;

          // 삭제된 댓글
          if (c.is_deleted) {
            return (
              <div key={c.id} className="text-center text-xs text-gray-400 py-2 italic">
                {isSupplierView ? "此留言已被管理员删除" : "관리자에 의해 삭제된 댓글입니다"}
              </div>
            );
          }

          // 메시지 표시 로직:
          // - 본인 댓글: 원문을 메인으로, 번역을 서브로
          // - 타인 댓글: 내 언어 번역을 메인으로, 원문을 서브로
          //   (바이어 화면: 한국어 번역 메인 / 공급업체 화면: 중국어 번역 메인)
          let mainText: string;
          let subText: string | null;
          let subLabel: string;

          if (isMe) {
            // 본인 댓글: 원문이 메인, 번역이 서브
            mainText = c.message;
            subText = c.translated_message;
            subLabel = isSupplierView ? "翻译" : "번역";
          } else {
            // 타인 댓글: 내 화면 언어의 번역이 메인
            const viewerWantsChinese = isSupplierView;
            const messageIsChinese = c.language === "zh";

            if (viewerWantsChinese === messageIsChinese) {
              // 같은 언어 → 원문이 메인, 번역이 서브
              mainText = c.message;
              subText = c.translated_message;
              subLabel = viewerWantsChinese ? "翻译" : "번역";
            } else {
              // 다른 언어 → 번역이 메인, 원문이 서브
              mainText = c.translated_message || c.message;
              subText = c.translated_message ? c.message : null;
              subLabel = viewerWantsChinese ? "原文" : "원문";
            }
          }

          return (
            <div key={c.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
              {/* 작성자 */}
              <div className="flex items-center gap-1.5 mb-1">
                {roleBadge(user.role)}
                <span className="text-[10px] text-gray-500 font-mono">{user.member_code || user.email.split("@")[0]}</span>
                <span className="text-[10px] text-gray-400">{formatTime(c.created_at)}</span>
                {c.is_reported && <span className="text-[10px] text-red-400">⚠</span>}
              </div>

              {/* 메인 메시지 */}
              <div className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                isMe ? "bg-blue-600 text-white rounded-br-md" : "bg-gray-100 text-gray-800 rounded-bl-md"
              }`}>
                {mainText}
              </div>

              {/* 번역/원문 (있으면) */}
              {subText && subText !== mainText && (
                <div className={`max-w-[85%] rounded-xl px-3 py-1 text-[11px] mt-0.5 ${
                  isMe ? "bg-blue-100 text-blue-800 rounded-br-md" : "bg-gray-50 text-gray-500 border rounded-bl-md"
                }`}>
                  <span className="text-[10px] text-gray-400 mr-1">{subLabel}:</span>
                  {subText}
                </div>
              )}

              {/* 수정 중인 댓글 */}
              {editingId === c.id && (
                <div className="mt-1 flex gap-1 max-w-[85%]">
                  <input type="text" value={editMsg} onChange={(e) => setEditMsg(e.target.value)}
                    className="flex-1 px-2 py-1 border rounded text-xs" placeholder={isSupplierView ? "修改内容" : "수정 내용"} />
                  <button onClick={() => handleEdit(c.id)} className="text-[10px] px-2 py-1 bg-blue-500 text-white rounded">
                    {isSupplierView ? "确认" : "확인"}
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-[10px] px-2 py-1 bg-gray-300 rounded">
                    {isSupplierView ? "取消" : "취소"}
                  </button>
                </div>
              )}

              {/* 삭제/수정/신고 버튼 */}
              <div className="flex gap-2 mt-0.5">
                {/* 본인 댓글: 수정/삭제 가능 */}
                {isMe && (
                  <button onClick={() => { setEditingId(c.id); setEditMsg(c.message); }}
                    className="text-[10px] text-blue-400 hover:text-blue-600">
                    {isSupplierView ? "修改" : "수정"}
                  </button>
                )}
                {isMe && (
                  <button onClick={() => handleDelete(c.id)} className="text-[10px] text-red-400 hover:text-red-600">
                    {isSupplierView ? "删除" : "삭제"}
                  </button>
                )}
                {/* 관리자: 타인 댓글 삭제 */}
                {isSuperAdmin && !isMe && (
                  <button onClick={() => handleDelete(c.id)} className="text-[10px] text-red-400 hover:text-red-600">
                    {isSupplierView ? "删除" : "삭제"}
                  </button>
                )}
                {!isMe && (
                  <button onClick={() => handleReport(c.id)} className="text-[10px] text-gray-400 hover:text-orange-500">
                    {isSupplierView ? "举报" : "신고"}
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* 차단 메시지 */}
      {blockedMsg && (
        <div className="mx-4 mb-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          {blockedMsg}
        </div>
      )}

      {/* 입력창 */}
      <div className="border-t p-3 flex gap-2">
        <textarea
          value={newMsg}
          onChange={(e) => { setNewMsg(e.target.value); setBlockedMsg(null); }}
          onKeyDown={handleKeyDown}
          placeholder={isSupplierView ? "请输入留言... (Enter发送)" : "댓글을 입력하세요... (Enter 전송)"}
          rows={1}
          className="flex-1 px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={handleSend} disabled={sending || !newMsg.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700 disabled:bg-gray-300">
          {sending ? "..." : isSupplierView ? "发送" : "전송"}
        </button>
      </div>
    </div>
  );
}
