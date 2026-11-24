import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import API from "../api/axios";
import {
  UserX,
  Users,
  Clock,
  CheckCircle2,
  XCircle,
  Search,
  RefreshCw,
  FileSpreadsheet,
  FileText,
  Copy,
  Check,
  Eye,
  Trash2,
  X,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import "./DeleteAccountRequests.css";

const REASONS_LIST = [
  "All Reasons",
  "Privacy Concerns",
  "Security Concerns",
  "Too Many Ads",
  "Found an Alternative",
  "Not Using App",
  "Technical Issues",
  "Other",
];

const DATES_LIST = [
  { label: "All Dates", value: "All" },
  { label: "Today", value: "today" },
  { label: "Last 7 Days", value: "7days" },
  { label: "Last 30 Days", value: "30days" },
];

export default function DeleteAccountRequestsPage() {
  const [requests, setRequests] = useState([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [statusFilter, setStatusFilter] = useState("All"); // All | Pending | Approved | Rejected
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("All Reasons");
  const [dateFilter, setDateFilter] = useState("All");

  // Selection & Feedback
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [copiedText, setCopiedText] = useState("");

  // Modals
  const [approveTarget, setApproveTarget] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectRemark, setRejectRemark] = useState("");
  const [viewTarget, setViewTarget] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Toast / Alert banner
  const [alertInfo, setAlertInfo] = useState(null);

  const showAlert = (title, message, type = "info") => {
    setAlertInfo({ title, message, type });
    setTimeout(() => setAlertInfo(null), 4000);
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch Requests
  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await API.get("/admin/delete-account-requests", {
        params: {
          page,
          limit: 10,
          status: statusFilter,
          search: debouncedSearch,
          reason: reasonFilter,
          dateFilter,
        },
      });

      if (res.data?.success) {
        setRequests(res.data.data || []);
        if (res.data.stats) {
          setStats(res.data.stats);
        }
        if (res.data.pagination) {
          setTotalPages(res.data.pagination.totalPages || 1);
          setTotalCount(res.data.pagination.total || 0);
        }
      }
    } catch (err) {
      console.error("Failed to fetch delete requests:", err);
      showAlert("Error", "Failed to load delete account requests.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
    setSelectedIds(new Set());
  }, [page, statusFilter, debouncedSearch, reasonFilter, dateFilter]);

  // Copy helper
  const handleCopy = (text) => {
    if (!text || text === "—" || text === "-") return;
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    setTimeout(() => setCopiedText(""), 1600);
  };

  // Select all handler
  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const all = new Set(requests.map((r) => r._id));
      setSelectedIds(all);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // Approve action (Wipe out all user data across 12 collections)
  const handleConfirmApprove = async () => {
    if (!approveTarget) return;
    setActionLoading(true);
    try {
      const res = await API.patch(`/admin/delete-account-requests/${approveTarget._id}/approve`);
      if (res.data?.success) {
        showAlert("Success", "Request approved! User account and all related data have been permanently erased.", "success");
        setApproveTarget(null);
        fetchRequests();
      }
    } catch (err) {
      showAlert("Error", err.response?.data?.message || "Failed to approve request", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Reject action
  const handleConfirmReject = async () => {
    if (!rejectTarget) return;
    setActionLoading(true);
    try {
      const res = await API.patch(`/admin/delete-account-requests/${rejectTarget._id}/reject`, {
        adminRemark: rejectRemark || "Request declined by administrator",
      });
      if (res.data?.success) {
        showAlert("Request Rejected", "Account deletion request has been rejected.", "info");
        setRejectTarget(null);
        setRejectRemark("");
        fetchRequests();
      }
    } catch (err) {
      showAlert("Error", err.response?.data?.message || "Failed to reject request", "error");
    } finally {
      setActionLoading(false);
    }
  };

  // Delete Log
  const handleDeleteLog = async (id) => {
    if (!window.confirm("Are you sure you want to delete this audit log record?")) return;
    try {
      await API.delete(`/admin/delete-account-requests/${id}`);
      showAlert("Deleted", "Audit log record removed.", "info");
      fetchRequests();
    } catch (err) {
      showAlert("Error", "Failed to delete log entry", "error");
    }
  };

  // Export Excel
  const handleExportExcel = () => {
    const dataToExport = selectedIds.size > 0
      ? requests.filter((r) => selectedIds.has(r._id))
      : requests;

    if (dataToExport.length === 0) {
      showAlert("Notice", "No records available to export.", "info");
      return;
    }

    const rows = dataToExport.map((r, i) => ({
      "S.No": i + 1,
      "User Name": r.userName || r.user?.name || "N/A",
      "User ID": r.user?._id || r.user || "N/A",
      "Email": r.userEmail || r.user?.email || "—",
      "Phone Number": r.userPhone || r.user?.phone || "—",
      "Request Date": r.createdAt ? new Date(r.createdAt).toLocaleString("en-IN") : "N/A",
      "Reason": r.reason || "Other",
      "User Comments": r.comments || "",
      "Status": r.status || "Pending",
      "Admin Remark": r.adminRemark || "",
      "Processed Date": r.processedAt ? new Date(r.processedAt).toLocaleString("en-IN") : "N/A",
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Delete_Requests");
    XLSX.writeFile(workbook, `delete-account-requests-${Date.now()}.xlsx`);
  };

  // Export PDF
  const handleExportPDF = () => {
    const dataToExport = selectedIds.size > 0
      ? requests.filter((r) => selectedIds.has(r._id))
      : requests;

    if (dataToExport.length === 0) {
      showAlert("Notice", "No records available to export.", "info");
      return;
    }

    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("Masti Adda OTT - Delete Account Requests Report", 14, 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Generated on: ${new Date().toLocaleString("en-IN")}`, 14, 21);
    doc.text(`Total Records: ${dataToExport.length}`, 14, 26);

    const tableColumn = ["#", "Name", "Email", "Phone", "Reason", "Status", "Date"];
    const tableRows = dataToExport.map((r, i) => [
      i + 1,
      r.userName || r.user?.name || "N/A",
      r.userEmail || r.user?.email || "—",
      r.userPhone || r.user?.phone || "—",
      r.reason || "Other",
      r.status || "Pending",
      r.createdAt ? new Date(r.createdAt).toLocaleDateString("en-IN") : "N/A",
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 32,
      theme: "striped",
      headStyles: { fillColor: [255, 209, 26], textColor: [0, 0, 0] },
      styles: { fontSize: 8 },
    });

    doc.save(`delete-account-requests-${Date.now()}.pdf`);
  };

  // Helper for Initials
  const getInitials = (name) => {
    if (!name) return "TU";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="del-requests-page">
      {/* ---------- Alert Banner ---------- */}
      {alertInfo && (
        <div
          style={{
            padding: "12px 18px",
            borderRadius: "10px",
            background:
              alertInfo.type === "success"
                ? "rgba(16, 185, 129, 0.15)"
                : alertInfo.type === "error"
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(59, 130, 246, 0.15)",
            border: `1px solid ${alertInfo.type === "success"
                ? "#10b981"
                : alertInfo.type === "error"
                  ? "#ef4444"
                  : "#3b82f6"
              }`,
            color: "var(--text)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.86rem",
          }}
        >
          <div>
            <strong>{alertInfo.title}:</strong> {alertInfo.message}
          </div>
          <button
            onClick={() => setAlertInfo(null)}
            style={{ background: "transparent", border: "none", color: "var(--text)", cursor: "pointer" }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* ---------- Page Header (GoliDoli Inline Style) ---------- */}
      <div className="del-page-header">
        <div className="del-header-title-wrap">
          <h1 className="del-page-title">
            <span className="del-title-icon"><UserX size={20} /></span>
            Delete Account Requests
          </h1>
          <p className="del-page-sub">
            Manage and review user account deletion requests submitted via the mobile app.
          </p>
        </div>

        <button onClick={fetchRequests} disabled={loading} className="del-refresh-btn">
          <RefreshCw size={13} className={loading ? "spin" : ""} />
          Refresh
        </button>
      </div>

      {/* ---------- Top 4 KPI Cards (GoliDoli Design Match) ---------- */}
      <div className="del-kpi-grid">
        {/* Total Requests */}
        <div className="del-kpi-card has-accent">
          <div className="del-kpi-top">
            <span className="del-kpi-label">TOTAL REQUESTS</span>
            <div className="del-kpi-icon-badge blue">
              <Users size={15} />
            </div>
          </div>
          <div className="del-kpi-value">{stats.total}</div>
          <div className="del-kpi-footer">All-time deletion submissions</div>
        </div>

        {/* Pending Requests */}
        <div className="del-kpi-card">
          <div className="del-kpi-top">
            <span className="del-kpi-label">PENDING REQUESTS</span>
            <div className="del-kpi-icon-badge amber">
              <Clock size={15} />
            </div>
          </div>
          <div className="del-kpi-value amber">{stats.pending}</div>
          <div className="del-kpi-footer amber">Awaiting admin action</div>
        </div>

        {/* Approved Requests */}
        <div className="del-kpi-card">
          <div className="del-kpi-top">
            <span className="del-kpi-label">APPROVED REQUESTS</span>
            <div className="del-kpi-icon-badge emerald">
              <CheckCircle2 size={15} />
            </div>
          </div>
          <div className="del-kpi-value emerald">{stats.approved}</div>
          <div className="del-kpi-footer emerald">Account data erased</div>
        </div>

        {/* Rejected Requests */}
        <div className="del-kpi-card">
          <div className="del-kpi-top">
            <span className="del-kpi-label">REJECTED REQUESTS</span>
            <div className="del-kpi-icon-badge rose">
              <XCircle size={15} />
            </div>
          </div>
          <div className="del-kpi-value rose">{stats.rejected}</div>
          <div className="del-kpi-footer rose">Declined / Canceled requests</div>
        </div>
      </div>

      {/* ---------- Main Content Card (GoliDoli Layout) ---------- */}
      <div className="del-content-card">
        {/* Toolbar Row 1: Search + Segmented Tabs + Export Buttons */}
        <div className="del-toolbar-row-1">
          <div className="del-toolbar-left-group">
            {/* Search Input */}
            <div className="del-search-field">
              <Search size={15} style={{ color: "#94a3b8", flexShrink: 0 }} />
              <input
                type="text"
                placeholder="Search user name, email, phone, or ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", display: "flex", padding: 0 }}
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Segmented Control Switch - Strictly complies with UI rule */}
            <div className="segmented-switch">
              {["All", "Pending", "Approved", "Rejected"].map((tab) => {
                const isActive = statusFilter === tab;
                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => {
                      setStatusFilter(tab);
                      setPage(1);
                    }}
                    className={`segmented-switch-btn ${isActive ? "active" : ""}`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="delReqStatusTab"
                        className="segmented-switch-active-bg"
                        transition={{ type: "spring", stiffness: 450, damping: 32 }}
                      />
                    )}
                    <span style={{ position: "relative", zIndex: 2 }}>{tab}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export Buttons on Top Right */}
          <div className="del-export-group">
            <button type="button" onClick={handleExportExcel} className="del-export-pill excel" title="Export to Excel">
              <FileSpreadsheet size={15} />
              Export Excel
            </button>
            <button type="button" onClick={handleExportPDF} className="del-export-pill pdf" title="Export to PDF">
              <FileText size={15} />
              Export PDF
            </button>
          </div>
        </div>

        {/* Toolbar Row 2: Dropdowns Placed Directly Underneath Search */}
        <div className="del-toolbar-row-2">
          {/* All Dates Dropdown */}
          <select
            value={dateFilter}
            onChange={(e) => {
              setDateFilter(e.target.value);
              setPage(1);
            }}
            className="del-dropdown-pill"
          >
            {DATES_LIST.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          {/* All Reasons Dropdown */}
          <select
            value={reasonFilter}
            onChange={(e) => {
              setReasonFilter(e.target.value);
              setPage(1);
            }}
            className="del-dropdown-pill"
          >
            {REASONS_LIST.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        {/* ---------- Data Table (GoliDoli Columns & Look) ---------- */}
        <div className="del-table-container">
          <table className="del-golidoli-table">
            <thead>
              <tr>
                <th style={{ width: "36px", textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={requests.length > 0 && selectedIds.size === requests.length}
                    onChange={handleSelectAll}
                  />
                </th>
                <th style={{ width: "45px", textAlign: "center" }}>#</th>
                <th style={{ minWidth: "200px" }}>USER DETAILS</th>
                <th style={{ minWidth: "160px" }}>EMAIL</th>
                <th style={{ minWidth: "140px" }}>PHONE NUMBER</th>
                <th style={{ width: "130px" }}>REQUEST DATE</th>
                <th style={{ minWidth: "180px" }}>REASON</th>
                <th style={{ width: "120px", textAlign: "center" }}>STATUS</th>
                <th style={{ width: "130px", textAlign: "center" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((req, idx) => {
                const isSelected = selectedIds.has(req._id);
                const userName = req.userName || req.user?.name || "Test User";
                const userEmail = req.userEmail || req.user?.email || "—";
                const userPhone = req.userPhone || req.user?.phone || "—";
                const userId = req.user?._id || req.user || "";
                const initials = getInitials(userName);

                return (
                  <tr key={req._id} style={{ background: isSelected ? "rgba(255, 209, 26, 0.06)" : "inherit" }}>
                    {/* Checkbox */}
                    <td style={{ textAlign: "center" }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleSelectOne(req._id)}
                      />
                    </td>

                    {/* S.No */}
                    <td style={{ textAlign: "center", color: "#64748b", fontSize: "0.82rem" }}>
                      {(page - 1) * 10 + idx + 1}
                    </td>

                    {/* USER DETAILS (Avatar + Name + ID + Copy) */}
                    <td>
                      <div className="del-user-meta">
                        <div className="del-avatar-circle">{initials}</div>
                        <div className="del-user-text">
                          <span className="del-name-title">{userName}</span>
                          {userId && (
                            <div className="del-id-row">
                              <span>{String(userId).slice(0, 10)}...</span>
                              <button
                                type="button"
                                className="del-inline-copy-btn"
                                onClick={() => handleCopy(String(userId))}
                                title="Copy User ID"
                              >
                                {copiedText === String(userId) ? (
                                  <Check size={11} color="#10B981" />
                                ) : (
                                  <Copy size={11} />
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* EMAIL */}
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ color: userEmail === "—" ? "#94a3b8" : "inherit" }}>{userEmail}</span>
                        {userEmail !== "—" && (
                          <button
                            type="button"
                            className="del-inline-copy-btn"
                            onClick={() => handleCopy(userEmail)}
                            title="Copy Email"
                          >
                            {copiedText === userEmail ? (
                              <Check size={11} color="#10B981" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* PHONE NUMBER */}
                    <td>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{ fontFamily: "monospace", fontSize: "0.84rem", color: userPhone === "—" ? "#94a3b8" : "inherit" }}>
                          {userPhone}
                        </span>
                        {userPhone !== "—" && (
                          <button
                            type="button"
                            className="del-inline-copy-btn"
                            onClick={() => handleCopy(userPhone)}
                            title="Copy Phone"
                          >
                            {copiedText === userPhone ? (
                              <Check size={11} color="#10B981" />
                            ) : (
                              <Copy size={11} />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* REQUEST DATE (Two Lines like GoliDoli) */}
                    <td>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <span style={{ fontWeight: 600, fontSize: "0.82rem" }}>
                          {req.createdAt ? new Date(req.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </span>
                        <span style={{ fontSize: "0.74rem", color: "#64748b" }}>
                          {req.createdAt ? new Date(req.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : ""}
                        </span>
                      </div>
                    </td>

                    {/* REASON (Badge + Comment like GoliDoli) */}
                    <td>
                      <div className="del-reason-wrapper">
                        <span className="del-reason-pill-box">{req.reason || "Other"}</span>
                        {req.comments && (
                          <span className="del-user-comment-line" title={req.comments}>
                            {req.comments}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* STATUS (GoliDoli Pill Badge) */}
                    <td style={{ textAlign: "center" }}>
                      <span className={`del-status-pill ${req.status?.toLowerCase() || "pending"}`}>
                        <span className="del-status-dot" />
                        {req.status || "Pending"}
                      </span>
                    </td>

                    {/* ACTIONS (GoliDoli 3 Square Action Buttons: Eye, Check, X) */}
                    <td style={{ textAlign: "center" }}>
                      <div className="del-action-buttons-group">
                        {/* 1. View Button */}
                        <button
                          type="button"
                          className="del-action-square-btn view"
                          onClick={() => setViewTarget(req)}
                          title="View Details"
                        >
                          <Eye size={15} />
                        </button>

                        {/* 2. Approve Button */}
                        <button
                          type="button"
                          className="del-action-square-btn approve"
                          disabled={req.status !== "Pending"}
                          onClick={() => setApproveTarget(req)}
                          title={req.status === "Pending" ? "Approve Request" : "Already Processed"}
                        >
                          <Check size={15} />
                        </button>

                        {/* 3. Reject Button */}
                        <button
                          type="button"
                          className="del-action-square-btn reject"
                          disabled={req.status !== "Pending"}
                          onClick={() => {
                            setRejectTarget(req);
                            setRejectRemark("");
                          }}
                          title={req.status === "Pending" ? "Reject Request" : "Already Processed"}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {requests.length === 0 && (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
                    {loading ? "Loading deletion requests..." : "No delete account requests found."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ---------- Footer Bar (GoliDoli Style) ---------- */}
        <div className="del-footer-bar">
          <div className="del-footer-count">
            Showing {requests.length > 0 ? (page - 1) * 10 + 1 : 0} to{" "}
            {Math.min(page * 10, totalCount)} of {totalCount} requests
          </div>

          <div className="del-pager-group">
            <button
              type="button"
              className="del-pager-btn"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              &lt; Prev
            </button>
            <span className="del-pager-indicator">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className="del-pager-btn"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next &gt;
            </button>
          </div>
        </div>
      </div>

      {/* =========================================================
          APPROVE CONFIRMATION MODAL (DATA ERASURE WARNING)
      ========================================================= */}
      <AnimatePresence>
        {approveTarget && (
          <div className="del-modal-overlay">
            <motion.div
              className="del-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="del-modal-header" style={{ borderBottomColor: "rgba(239, 68, 68, 0.2)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#ef4444" }}>
                  <ShieldAlert size={22} />
                  <strong style={{ fontSize: "1rem" }}>Confirm Permanent Data Erasure</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setApproveTarget(null)}
                  style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="del-modal-body">
                <p style={{ margin: 0, lineHeight: 1.5 }}>
                  Are you sure you want to approve the deletion request for{" "}
                  <strong>{approveTarget.userName || approveTarget.user?.name || "this user"}</strong>?
                </p>

                <div
                  style={{
                    background: "rgba(239, 68, 68, 0.08)",
                    border: "1px solid rgba(239, 68, 68, 0.25)",
                    borderRadius: "10px",
                    padding: "12px 14px",
                    fontSize: "0.8rem",
                    color: "var(--text)",
                    lineHeight: 1.6,
                  }}
                >
                  <strong style={{ color: "#ef4444", display: "block", marginBottom: 4 }}>
                    ⚠️ This action cannot be undone!
                  </strong>
                  The system will permanently wipe out:
                  <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                    <li>User Profile & Credentials</li>
                    <li>Active / Expired Subscriptions</li>
                    <li>Watchlist, Ratings & Interaction history</li>
                    <li>Watch progress, comments & support tickets across 12 collections</li>
                  </ul>
                </div>

                <div style={{ fontSize: "0.78rem", color: "#64748b" }}>
                  User Phone: <code>{approveTarget.userPhone || approveTarget.user?.phone || "N/A"}</code> | User ID:{" "}
                  <code>{approveTarget.user?._id || approveTarget.user}</code>
                </div>
              </div>

              <div className="del-modal-footer">
                <button
                  type="button"
                  onClick={() => setApproveTarget(null)}
                  disabled={actionLoading}
                  style={{ background: "transparent", border: "1px solid #cbd5e1", color: "#334155", padding: "7px 16px", borderRadius: "8px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmApprove}
                  disabled={actionLoading}
                  style={{ background: "#ef4444", border: "none", color: "#ffffff", padding: "7px 18px", borderRadius: "8px", fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                >
                  {actionLoading ? <RefreshCw size={14} className="spin" /> : <Trash2 size={14} />}
                  Erase All Data Now
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================
          REJECT REQUEST MODAL
      ========================================================= */}
      <AnimatePresence>
        {rejectTarget && (
          <div className="del-modal-overlay">
            <motion.div
              className="del-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="del-modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 10, color: "#f59e0b" }}>
                  <AlertTriangle size={20} />
                  <strong style={{ fontSize: "1rem" }}>Decline Deletion Request</strong>
                </div>
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="del-modal-body">
                <p style={{ margin: 0 }}>
                  You are declining the deletion request for{" "}
                  <strong>{rejectTarget.userName || rejectTarget.user?.name || "User"}</strong>. User data will remain intact.
                </p>

                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#64748b" }}>
                    Admin Remark / Reason for Decline:
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Account has active disputes or user cancelled request..."
                    value={rejectRemark}
                    onChange={(e) => setRejectRemark(e.target.value)}
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      background: "var(--bg3)",
                      border: "1px solid var(--border)",
                      color: "var(--text)",
                      outline: "none",
                      fontSize: "0.84rem",
                    }}
                  />
                </div>
              </div>

              <div className="del-modal-footer">
                <button
                  type="button"
                  onClick={() => setRejectTarget(null)}
                  disabled={actionLoading}
                  style={{ background: "transparent", border: "1px solid #cbd5e1", color: "#334155", padding: "7px 16px", borderRadius: "8px", cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReject}
                  disabled={actionLoading}
                  style={{ background: "#f59e0b", border: "none", color: "#000000", padding: "7px 18px", borderRadius: "8px", fontWeight: 700, cursor: "pointer" }}
                >
                  {actionLoading ? "Declining..." : "Confirm Decline"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* =========================================================
          VIEW DETAILS MODAL
      ========================================================= */}
      <AnimatePresence>
        {viewTarget && (
          <div className="del-modal-overlay">
            <motion.div
              className="del-modal-card"
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="del-modal-header">
                <strong style={{ fontSize: "1rem" }}>Deletion Request Audit Trail</strong>
                <button
                  type="button"
                  onClick={() => setViewTarget(null)}
                  style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="del-modal-body" style={{ gap: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>User Name</span>
                    <div style={{ fontWeight: 600 }}>{viewTarget.userName || viewTarget.user?.name || "N/A"}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>Status</span>
                    <div>
                      <span className={`del-status-pill ${viewTarget.status?.toLowerCase()}`}>
                        {viewTarget.status}
                      </span>
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>Email</span>
                    <div>{viewTarget.userEmail || viewTarget.user?.email || "—"}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>Phone Number</span>
                    <div>{viewTarget.userPhone || viewTarget.user?.phone || "—"}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>Request Date</span>
                    <div>{viewTarget.createdAt ? new Date(viewTarget.createdAt).toLocaleString("en-IN") : "N/A"}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>Processed Date</span>
                    <div>{viewTarget.processedAt ? new Date(viewTarget.processedAt).toLocaleString("en-IN") : "—"}</div>
                  </div>
                </div>

                <div style={{ borderTop: "1px solid var(--border)", paddingTop: 10 }}>
                  <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>Reason Category</span>
                  <div style={{ fontWeight: 600, marginTop: 2 }}>{viewTarget.reason || "Other"}</div>
                </div>

                <div>
                  <span style={{ fontSize: "0.72rem", color: "#64748b", textTransform: "uppercase" }}>User Feedback / Comments</span>
                  <div style={{ background: "var(--bg3)", padding: "8px 12px", borderRadius: "8px", marginTop: 4, fontStyle: "italic", fontSize: "0.82rem" }}>
                    {viewTarget.comments || "No comments provided by user."}
                  </div>
                </div>

                {viewTarget.adminRemark && (
                  <div>
                    <span style={{ fontSize: "0.72rem", color: "#f59e0b", textTransform: "uppercase" }}>Admin Remarks</span>
                    <div style={{ background: "rgba(245, 158, 11, 0.1)", padding: "8px 12px", borderRadius: "8px", marginTop: 4, fontSize: "0.82rem" }}>
                      {viewTarget.adminRemark}
                    </div>
                  </div>
                )}
              </div>

              <div className="del-modal-footer">
                <button
                  type="button"
                  onClick={() => setViewTarget(null)}
                  style={{ background: "#ffffff", border: "1px solid #cbd5e1", color: "#0f172a", padding: "7px 16px", borderRadius: "8px", cursor: "pointer" }}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
