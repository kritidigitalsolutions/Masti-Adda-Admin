import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutTemplate,
  ImageIcon,
  Rows3,
  Search,
  X,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle,
  AlertCircle,
  GripVertical,
  Pencil,
} from "lucide-react";
import API, { BASE_URL } from "../api/axios";
import "./Dashboard.css";
import "./WebpageLayout.css";

// ── Helpers ────────────────────────────────────────────────────────────────

const getImageUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const cleanBase = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
};

const contentTypeLabel = (type) => {
  if (!type) return "";
  const t = type.toLowerCase();
  if (t === "movie") return "Movie";
  if (t === "series") return "Series";
  if (t === "microdrama") return "Microdrama";
  return type;
};

// Move item in array from index to newIndex (splice-based)
const moveInArray = (arr, fromIdx, toIdx) => {
  const copy = [...arr];
  const [item] = copy.splice(fromIdx, 1);
  copy.splice(toIdx, 0, item);
  return copy;
};

// Extract ObjectId string regardless of whether contentId is populated or raw
const extractId = (contentId) => contentId?._id || contentId;

// ── Sub-components ─────────────────────────────────────────────────────────

/** Single banner card — landscape style matching reference design */
function BannerCard({ item, index, total, onRemove, onMove }) {
  const [posInput, setPosInput] = useState(String(index + 1));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    setPosInput(String(index + 1));
  }, [index]);

  const handlePosBlur = () => {
    const newPos = parseInt(posInput, 10) - 1;
    if (isNaN(newPos) || newPos === index || newPos < 0 || newPos >= total) {
      setPosInput(String(index + 1));
      setEditing(false);
      return;
    }
    onMove(index, newPos);
    setEditing(false);
  };

  // Use banner image for landscape, fall back to poster
  const img = getImageUrl(
    item.contentId?.banner || item.contentId?.poster || item.banner || item.poster
  );
  const title = item.contentId?.title || item.title || "Unknown";
  const type = contentTypeLabel(item.contentType || item.contentId?.type);
  const posNum = String(index + 1).padStart(2, "0");

  return (
    <div className="wl-banner-card">
      {/* ── Image area ── */}
      <div className="wl-banner-media">
        {img ? (
          <img src={img} alt={title} className="wl-banner-img" />
        ) : (
          <div className="wl-banner-placeholder">
            <ImageIcon size={32} />
          </div>
        )}
        {/* Position number — top left */}
        <span className="wl-banner-num">{posNum}</span>
        {/* Content type — top right */}
        <span className={`wl-banner-type wl-type ${type}`}>{type.toUpperCase()}</span>
      </div>

      {/* ── Footer row ── */}
      <div className="wl-banner-footer">
        <span className="wl-banner-title">{title}</span>
        <div className="wl-banner-actions">
          {/* POS badge + editable input */}
          <div className="wl-pos-badge" onClick={() => setEditing(true)} title="Change position">
            <span className="wl-pos-label">POS</span>
            {editing ? (
              <input
                className="wl-pos-edit-input"
                autoFocus
                value={posInput}
                onChange={(e) => setPosInput(e.target.value)}
                onBlur={handlePosBlur}
                onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="wl-pos-num">{index + 1}</span>
            )}
          </div>
          {/* Edit icon (triggers pos editing) */}
          <button
            className="wl-banner-action-btn wl-banner-action-btn--edit"
            onClick={() => setEditing(true)}
            title="Change position"
          >
            <Pencil size={13} />
          </button>
          {/* Delete */}
          <button
            className="wl-banner-action-btn wl-banner-action-btn--del"
            onClick={() => onRemove(index)}
            title="Remove"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Search dropdown for adding hero banners */
function BannerSearchBar({ allContent, selected, onAdd }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectedIds = new Set(selected.map((s) => extractId(s.contentId)?.toString()));

  const filtered = allContent.filter((c) => {
    if (selectedIds.has(c._id?.toString())) return false;
    return c.title?.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="wl-search-wrap" ref={ref}>
      <div className="wl-mini-search">
        <Search size={14} className="search-icon" />
        <input
          className="search-input"
          placeholder="Search to add a movie or series..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
        {query && (
          <button className="search-clear" onClick={() => { setQuery(""); setOpen(false); }}>
            <X size={13} />
          </button>
        )}
      </div>
      <AnimatePresence>
        {open && query.length > 0 && (
          <motion.ul
            className="wl-search-dropdown"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
          >
            {filtered.length === 0 ? (
              <li className="wl-search-empty">No results found</li>
            ) : (
              filtered.slice(0, 10).map((c) => (
                <li
                  key={c._id}
                  className="wl-search-item"
                  onClick={() => {
                    onAdd(c);
                    setQuery("");
                    setOpen(false);
                  }}
                >
                  {c.poster && (
                    <img src={getImageUrl(c.poster)} alt={c.title} className="wl-search-thumb" />
                  )}
                  <div className="wl-search-info">
                    <span className="wl-search-title">{c.title}</span>
                    <span className={`wl-type ${contentTypeLabel(c.type)}`}>
                      {contentTypeLabel(c.type)}
                    </span>
                  </div>
                  <Plus size={14} className="wl-search-add-icon" />
                </li>
              ))
            )}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Curator grid for a single carousel section */
function SectionCurator({ section, allContent, onToggleItem, onMoveItem }) {
  const [search, setSearch] = useState("");
  const [editingPos, setEditingPos] = useState(null); // idx being edited
  const [posInput, setPosInput] = useState("");

  const selectedIds = new Set(
    (section.items || []).map((i) => extractId(i.contentId)?.toString())
  );

  // Filter allContent to items matching categorySlug
  const categoryContent = allContent.filter((c) => {
    if (!c.category) return false;
    const cats = Array.isArray(c.category) ? c.category : [c.category];
    return cats.some(
      (cat) =>
        cat?.toLowerCase?.() === section.categorySlug?.toLowerCase()
    );
  });

  const filtered = categoryContent.filter((c) =>
    c.title?.toLowerCase().includes(search.toLowerCase())
  );

  const selectedItems = (section.items || []).map((i) => {
    const id = extractId(i.contentId)?.toString();
    const found = allContent.find((c) => c._id?.toString() === id);
    return found ? { ...i, contentId: found } : i;
  });

  const unselected = filtered.filter(
    (c) => !selectedIds.has(c._id?.toString())
  );

  const handlePosBlur = (currentIdx) => {
    const newIdx = parseInt(posInput, 10) - 1;
    if (!isNaN(newIdx) && newIdx !== currentIdx && newIdx >= 0 && newIdx < selectedItems.length) {
      onMoveItem(section, currentIdx, newIdx);
    }
    setEditingPos(null);
    setPosInput("");
  };

  return (
    <div className="wl-curator">
      <div className="wl-curator-toolbar">
        <span className="wl-count-label">
          {selectedItems.length} selected
        </span>
        <div className="wl-mini-search">
          <Search size={13} className="search-icon" />
          <input
            className="search-input"
            placeholder="Filter content..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="search-clear" onClick={() => setSearch("")}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="wl-grid">
        {/* Selected items first — with POS badge just like hero banners */}
        {selectedItems.map((item, idx) => {
          const poster = getImageUrl(item.contentId?.poster || item.poster);
          const title = item.contentId?.title || item.title || "Unknown";
          const type = contentTypeLabel(item.contentType || item.contentId?.type);
          const id = extractId(item.contentId)?.toString();
          const posNum = idx + 1;
          const posFormatted = String(posNum).padStart(2, "0");
          const isEditingThis = editingPos === idx;

          return (
            <div
              key={`sel-${id || idx}`}
              className="wl-card wl-card--selected"
            >
              <div
                className="wl-card-media"
                onClick={() => onToggleItem(section, item.contentId || item, true)}
                title="Click to remove"
              >
                {poster ? (
                  <img src={poster} alt={title} className="wl-poster" />
                ) : (
                  <div className="wl-poster-placeholder"><ImageIcon size={24} /></div>
                )}
                {/* 01, 02 number on top-left */}
                <span className="wl-banner-num">{posFormatted}</span>
                {/* ✓ check badge top-right */}
                <span className="wl-card-badge wl-card-badge--check">✓</span>
              </div>
              <div className="wl-card-body">
                <p className="wl-card-title">{title}</p>
                <div className="wl-card-foot">
                  <span className={`wl-type ${type}`}>{type}</span>
                  {/* POS badge + editable input just like hero banners */}
                  <div
                    className="wl-pos-badge"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPos(idx);
                      setPosInput(String(posNum));
                    }}
                    title="Change position by typing"
                  >
                    <span className="wl-pos-label">POS</span>
                    {isEditingThis ? (
                      <input
                        className="wl-pos-edit-input"
                        autoFocus
                        value={posInput}
                        onChange={(e) => setPosInput(e.target.value)}
                        onBlur={() => handlePosBlur(idx)}
                        onKeyDown={(e) => e.key === "Enter" && e.target.blur()}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span className="wl-pos-num">{posNum}</span>
                    )}
                  </div>
                  <button
                    className="wl-banner-action-btn wl-banner-action-btn--edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPos(idx);
                      setPosInput(String(posNum));
                    }}
                    title="Change position"
                  >
                    <Pencil size={11} />
                  </button>
                  <button
                    className="wl-card-del"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleItem(section, item.contentId || item, true);
                    }}
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Unselected items (dimmed) */}
        {unselected.map((c) => {
          const poster = getImageUrl(c.poster);
          const type = contentTypeLabel(c.type);
          return (
            <div
              key={c._id}
              className="wl-card wl-card--dim"
              onClick={() => onToggleItem(section, c, false)}
              title="Click to add"
            >
              <div className="wl-card-media">
                {poster ? (
                  <img src={poster} alt={c.title} className="wl-poster" />
                ) : (
                  <div className="wl-poster-placeholder"><ImageIcon size={24} /></div>
                )}
                <span className="wl-card-badge wl-card-badge--add">+</span>
              </div>
              <div className="wl-card-body">
                <p className="wl-card-title">{c.title}</p>
                <div className="wl-card-foot">
                  <span className={`wl-type ${type}`}>{type}</span>
                </div>
              </div>
            </div>
          );
        })}

        {categoryContent.length === 0 && (
          <p className="wl-empty-hint">
            No content tagged with category <strong>"{section.categorySlug}"</strong>.
            Tag content in Content Library first.
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

export default function WebpageLayout() {
  const [activeTab, setActiveTab] = useState("banners");
  const [heroBanners, setHeroBanners] = useState([]);
  const [sections, setSections] = useState([]);
  const [allContent, setAllContent] = useState([]);
  const [categories, setCategories] = useState([]);
  const [expandedSections, setExpandedSections] = useState({});
  const [editingTitles, setEditingTitles] = useState({});
  const [addRowSlug, setAddRowSlug] = useState("");
  const [addRowTitle, setAddRowTitle] = useState("");
  const [addRowPos, setAddRowPos] = useState("");
  const [editingRowPos, setEditingRowPos] = useState(null);
  const [rowPosInput, setRowPosInput] = useState("");
  const [showAddRow, setShowAddRow] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [layoutRes, catsRes, contentRes] = await Promise.all([
          API.get("/admin/webpage-layout"),
          API.get("/admin/categories"),
          API.get("/admin/content/all"),
        ]);

        const layout = layoutRes.data?.data || {};
        setHeroBanners(layout.heroBanners || []);
        setSections(layout.sections || []);

        const cats = catsRes.data?.data || catsRes.data?.categories || [];
        // Only show active categories
        setCategories(cats.filter((c) => c.isActive !== false));

        // Flatten content list — filter out 18+ on frontend too
        const rawContent = contentRes.data?.content || contentRes.data?.data || [];
        const safe = rawContent.filter(
          (c) => c.is18plus !== true && c.isPublished !== false
        );
        // Normalize: add `type` from `contentType` if missing
        const normalized = safe.map((c) => ({
          ...c,
          type: c.type || c.contentType || "movie",
        }));
        setAllContent(normalized);
      } catch (err) {
        console.error("WebpageLayout load error:", err);
        showToast("Failed to load layout data", "error");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Publish (save) ───────────────────────────────────────────────────────
  const handlePublish = async () => {
    setSaving(true);
    try {
      const payload = {
        heroBanners: heroBanners.map((b) => ({
          contentType: b.contentType,
          contentId: extractId(b.contentId),
        })),
        sections: sections.map((s) => ({
          categorySlug: s.categorySlug,
          title: s.title,
          items: (s.items || []).map((i) => ({
            contentType: i.contentType,
            contentId: extractId(i.contentId),
          })),
        })),
      };

      await API.post("/admin/webpage-layout", payload);
      showToast("Layout published successfully! 🎉");
    } catch (err) {
      const msg = err.response?.data?.message || "Failed to publish layout";
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  // ── Hero Banners actions ─────────────────────────────────────────────────
  const addBanner = (content) => {
    const alreadyAdded = heroBanners.some(
      (b) => extractId(b.contentId)?.toString() === content._id?.toString()
    );
    if (alreadyAdded) return;
    setHeroBanners((prev) => [
      ...prev,
      { contentType: contentTypeLabel(content.type), contentId: content },
    ]);
  };

  const removeBanner = (idx) => {
    setHeroBanners((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveBanner = (fromIdx, toIdx) => {
    setHeroBanners((prev) => moveInArray(prev, fromIdx, toIdx));
  };

  // ── Sections actions ─────────────────────────────────────────────────────
  const addSection = () => {
    if (!addRowSlug) return;
    const alreadyExists = sections.some((s) => s.categorySlug === addRowSlug);
    if (alreadyExists) {
      showToast("A row for this category already exists", "error");
      return;
    }
    const cat = categories.find((c) => (c.slug || c._id) === addRowSlug);
    const title = addRowTitle.trim() || cat?.name || addRowSlug;
    const newSection = { categorySlug: addRowSlug, title, items: [] };

    setSections((prev) => {
      const copy = [...prev];
      const targetPos = parseInt(addRowPos, 10) - 1;
      if (!isNaN(targetPos) && targetPos >= 0 && targetPos <= copy.length) {
        copy.splice(targetPos, 0, newSection);
      } else {
        copy.push(newSection);
      }
      return copy;
    });

    setAddRowSlug("");
    setAddRowTitle("");
    setAddRowPos("");
    setShowAddRow(false);
  };

  const removeSection = (idx) => {
    setSections((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveSection = (idx, dir) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= sections.length) return;
    setSections((prev) => moveInArray(prev, idx, newIdx));
  };

  const moveSectionToPos = (fromIdx, toIdx) => {
    if (toIdx < 0 || toIdx >= sections.length || fromIdx === toIdx) return;
    setSections((prev) => moveInArray(prev, fromIdx, toIdx));
  };

  const handleRowPosBlur = (currentIdx) => {
    const newIdx = parseInt(rowPosInput, 10) - 1;
    if (!isNaN(newIdx) && newIdx !== currentIdx && newIdx >= 0 && newIdx < sections.length) {
      moveSectionToPos(currentIdx, newIdx);
    }
    setEditingRowPos(null);
    setRowPosInput("");
  };

  const updateSectionTitle = (idx, title) => {
    setSections((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, title } : s))
    );
  };

  const toggleExpanded = (idx) => {
    setExpandedSections((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  // Toggle content item in/out of a section
  const toggleSectionItem = (section, content, isSelected) => {
    const sectionIdx = sections.findIndex(
      (s) => s.categorySlug === section.categorySlug
    );
    if (sectionIdx === -1) return;

    setSections((prev) => {
      const updated = [...prev];
      const sec = { ...updated[sectionIdx] };

      if (isSelected) {
        // Remove
        const contentId = extractId(content)?.toString();
        sec.items = (sec.items || []).filter(
          (i) => extractId(i.contentId)?.toString() !== contentId
        );
      } else {
        // Add
        sec.items = [
          ...(sec.items || []),
          { contentType: contentTypeLabel(content.type), contentId: content },
        ];
      }

      updated[sectionIdx] = sec;
      return updated;
    });
  };

  // Reorder item inside a section by position
  const moveSectionItem = (section, fromIdx, toIdx) => {
    const sectionIdx = sections.findIndex(
      (s) => s.categorySlug === section.categorySlug
    );
    if (sectionIdx === -1) return;
    setSections((prev) => {
      const updated = [...prev];
      const sec = { ...updated[sectionIdx] };
      sec.items = moveInArray(sec.items || [], fromIdx, toIdx);
      updated[sectionIdx] = sec;
      return updated;
    });
  };

  // ── Tabs ─────────────────────────────────────────────────────────────────
  const tabs = [
    { id: "banners", label: "Hero Banners", count: heroBanners.length, icon: ImageIcon },
    { id: "sections", label: "Carousel Rows", count: sections.length, icon: Rows3 },
  ];

  // ── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="wl-loading">
        <Loader2 size={32} className="wl-spin" />
        <span>Loading layout...</span>
      </div>
    );
  }

  return (
    <div className="wl-page">
      {/* ── Header ── */}
      <div className="wl-header">
        <div className="wl-header-left">
          <div className="wl-header-icon">
            <LayoutTemplate size={22} />
          </div>
          <div>
            <h1 className="wl-title">Webpage Layout Manager</h1>
            <p className="wl-subtitle">
              Configure the hero slider and carousel rows shown on the website.
            </p>
          </div>
        </div>
        <button
          className="wl-publish-btn"
          onClick={handlePublish}
          disabled={saving}
        >
          {saving ? (
            <><Loader2 size={15} className="wl-spin" /> Publishing...</>
          ) : (
            <><LayoutTemplate size={15} /> Publish Layout</>
          )}
        </button>
      </div>

      {/* ── Segmented Switch Tabs (per UI Rule) ── */}
      <div className="wl-tabs-wrap">
        <div className="segmented-switch">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`segmented-switch-btn${activeTab === tab.id ? " active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {activeTab === tab.id && (
                <motion.div
                  className="segmented-switch-active-bg"
                  layoutId="wl-tab-pill"
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span className="segmented-switch-content">
                <tab.icon size={14} />
                {tab.label}
                <span className="wl-tab-count">{tab.count}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        {activeTab === "banners" && (
          <motion.div
            key="banners"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="wl-section-card">
              <div className="wl-section-header">
                <div>
                  <h2 className="wl-section-title">Hero Slider Banners</h2>
                  <p className="wl-section-desc">
                    Select movies or series to appear in the top hero slider on the website.
                  </p>
                </div>
                <BannerSearchBar
                  allContent={allContent}
                  selected={heroBanners}
                  onAdd={addBanner}
                />
              </div>

              {heroBanners.length === 0 ? (
                <div className="wl-empty-state">
                  <ImageIcon size={36} />
                  <p>No hero banners added yet.</p>
                  <span>Use the search above to add movies or series.</span>
                </div>
              ) : (
                <div className="wl-banner-grid">
                  {heroBanners.map((item, idx) => (
                    <BannerCard
                      key={`banner-${extractId(item.contentId)}-${idx}`}
                      item={item}
                      index={idx}
                      total={heroBanners.length}
                      onRemove={removeBanner}
                      onMove={moveBanner}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {activeTab === "sections" && (
          <motion.div
            key="sections"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="wl-section-card">
              <div className="wl-section-header">
                <div>
                  <h2 className="wl-section-title">Carousel Rows</h2>
                  <p className="wl-section-desc">
                    Add and arrange content rows displayed on the website homepage.
                  </p>
                </div>
                <button
                  className="wl-add-row-btn"
                  onClick={() => setShowAddRow((v) => !v)}
                >
                  <Plus size={15} /> Add Row
                </button>
              </div>

              {/* Add Row Form */}
              <AnimatePresence>
                {showAddRow && (
                  <motion.div
                    className="wl-add-row-form"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <select
                      className="wl-select"
                      value={addRowSlug}
                      onChange={(e) => {
                        setAddRowSlug(e.target.value);
                        const cat = categories.find(
                          (c) => (c.slug || c._id) === e.target.value
                        );
                        setAddRowTitle(cat?.name || "");
                      }}
                    >
                      <option value="">— Select a category —</option>
                      {categories
                        .filter(
                          (cat) =>
                            !sections.some(
                              (s) => s.categorySlug === (cat.slug || cat._id)
                            )
                        )
                        .map((cat) => (
                          <option key={cat._id} value={cat.slug || cat._id}>
                            {cat.name}
                          </option>
                        ))}
                    </select>
                    <input
                      className="wl-input"
                      placeholder="Row title (optional)"
                      value={addRowTitle}
                      onChange={(e) => setAddRowTitle(e.target.value)}
                    />
                    <input
                      className="wl-input"
                      type="number"
                      min="1"
                      placeholder="Pos (optional)"
                      style={{ maxWidth: "120px" }}
                      value={addRowPos}
                      onChange={(e) => setAddRowPos(e.target.value)}
                    />
                    <button
                      className="wl-publish-btn"
                      onClick={addSection}
                      disabled={!addRowSlug}
                    >
                      <Plus size={14} /> Add
                    </button>
                    <button
                      className="wl-cancel-btn"
                      onClick={() => {
                        setShowAddRow(false);
                        setAddRowSlug("");
                        setAddRowTitle("");
                      }}
                    >
                      Cancel
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Sections Accordion */}
              {sections.length === 0 ? (
                <div className="wl-empty-state">
                  <Rows3 size={36} />
                  <p>No carousel rows added yet.</p>
                  <span>Click "Add Row" to create your first carousel section.</span>
                </div>
              ) : (
                <div className="wl-accordion-list">
                  {sections.map((section, idx) => (
                    <div key={`sec-${section.categorySlug}-${idx}`} className="wl-accordion">
                      {/* Accordion Header */}
                      <div className="wl-accordion-header">
                        {/* Reorder buttons */}
                        <div className="wl-reorder-btns">
                          <button
                            className="wl-reorder-btn"
                            onClick={() => moveSection(idx, -1)}
                            disabled={idx === 0}
                            title="Move up"
                          >
                            <ChevronUp size={14} />
                          </button>
                          <button
                            className="wl-reorder-btn"
                            onClick={() => moveSection(idx, 1)}
                            disabled={idx === sections.length - 1}
                            title="Move down"
                          >
                            <ChevronDown size={14} />
                          </button>
                        </div>

                        {/* Title (editable) */}
                        <div
                          className="wl-accordion-title-wrap"
                          onClick={() => toggleExpanded(idx)}
                        >
                          <span className="wl-row-pos-badge">ROW {String(idx + 1).padStart(2, "0")}</span>
                          {editingTitles[idx] ? (
                            <input
                              className="wl-title-input"
                              value={section.title}
                              autoFocus
                              onChange={(e) => updateSectionTitle(idx, e.target.value)}
                              onBlur={() =>
                                setEditingTitles((prev) => ({ ...prev, [idx]: false }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  setEditingTitles((prev) => ({ ...prev, [idx]: false }));
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span className="wl-accordion-title">{section.title}</span>
                          )}
                          <span className="wl-slug-badge">{section.categorySlug}</span>
                          <span className="wl-item-count">
                            {(section.items || []).length} items
                          </span>
                        </div>

                        {/* Right actions */}
                        <div className="wl-accordion-actions">
                          {/* POS badge + editable input just like hero banners */}
                          <div
                            className="wl-pos-badge"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRowPos(idx);
                              setRowPosInput(String(idx + 1));
                            }}
                            title="Change row position by typing"
                          >
                            <span className="wl-pos-label">POS</span>
                            {editingRowPos === idx ? (
                              <input
                                className="wl-pos-edit-input"
                                autoFocus
                                value={rowPosInput}
                                onChange={(e) => setRowPosInput(e.target.value)}
                                onBlur={() => handleRowPosBlur(idx)}
                                onKeyDown={(e) => e.key === "Enter" && handleRowPosBlur(idx)}
                                onClick={(e) => e.stopPropagation()}
                              />
                            ) : (
                              <span className="wl-pos-num">{idx + 1}</span>
                            )}
                          </div>
                          <button
                            className="wl-banner-action-btn wl-banner-action-btn--edit"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingRowPos(idx);
                              setRowPosInput(String(idx + 1));
                            }}
                            title="Change row position by typing"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            className="wl-icon-btn"
                            title="Edit title"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingTitles((prev) => ({ ...prev, [idx]: true }));
                              if (!expandedSections[idx]) toggleExpanded(idx);
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            className="wl-icon-btn wl-icon-btn--danger"
                            title="Remove row"
                            onClick={() => removeSection(idx)}
                          >
                            <Trash2 size={14} />
                          </button>
                          <button
                            className="wl-expand-btn"
                            onClick={() => toggleExpanded(idx)}
                          >
                            {expandedSections[idx] ? (
                              <ChevronUp size={16} />
                            ) : (
                              <ChevronDown size={16} />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Accordion Body — Curator Grid */}
                      <AnimatePresence>
                        {expandedSections[idx] && (
                          <motion.div
                            className="wl-accordion-body"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.22 }}
                          >
                            <SectionCurator
                              section={section}
                              allContent={allContent}
                              onToggleItem={toggleSectionItem}
                              onMoveItem={moveSectionItem}
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`wl-toast wl-toast--${toast.type}`}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.25 }}
          >
            {toast.type === "success" ? (
              <CheckCircle size={16} />
            ) : (
              <AlertCircle size={16} />
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
