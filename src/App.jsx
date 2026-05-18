import { useEffect, useMemo, useRef, useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./components/ui/collapsible";
import windowIcon from "../assets/icon.svg";

const GUIDE_STEPS = [
  {
    title: "打开商店页面",
    description: "点击“打开 Microsoft Store”，进入目标应用页面。"
  },
  {
    title: "复制应用链接",
    description: "复制当前应用页面的完整地址。"
  },
  {
    title: "提交查询",
    description: "粘贴链接后，根据需要选择发布通道、语言和地区。"
  },
  {
    title: "获取下载地址",
    description: "点击“查询文件”，在下方结果中打开所需文件。"
  }
];

const RING_OPTIONS = [
  { value: "Retail", label: "Retail" },
  { value: "RP", label: "RP" },
  { value: "WIS", label: "WIS" },
  { value: "WIF", label: "WIF" }
];

const LANGUAGE_OPTIONS = [
  { value: "zh-CN", label: "简体中文 (zh-CN)" },
  { value: "en-US", label: "English (en-US)" }
];

const REGION_OPTIONS = [
  { value: "CN", label: "中国大陆 (CN)" },
  { value: "US", label: "United States (US)" },
  { value: "HK", label: "中国香港 (HK)" },
  { value: "TW", label: "中国台湾 (TW)" },
  { value: "JP", label: "日本 (JP)" },
  { value: "KR", label: "韩国 (KR)" },
  { value: "SG", label: "新加坡 (SG)" },
  { value: "GB", label: "United Kingdom (GB)" },
  { value: "DE", label: "Deutschland (DE)" },
  { value: "FR", label: "France (FR)" },
  { value: "CA", label: "Canada (CA)" },
  { value: "AU", label: "Australia (AU)" }
];

const DEFAULT_STORE_URL = "https://apps.microsoft.com/detail/9plm9xgg6vks?hl=zh-CN";

function getStoreApi() {
  if (window.storeApi?.fetchAppMetadata && window.storeApi?.queryFiles && window.storeApi?.openExternal) {
    return window.storeApi;
  }

  return {
    fetchAppMetadata: async () => {
      throw new Error("当前为界面预览模式，请在桌面应用中执行识别。");
    },
    queryFiles: async () => {
      throw new Error("当前为界面预览模式，请在桌面应用中执行查询。");
    },
    openExternal: async (url) => {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };
}

function cn(...values) {
  return values.filter(Boolean).join(" ");
}

function isSupportedStoreUrl(value) {
  if (!value) {
    return false;
  }

  try {
    const parsed = new URL(value);
    return /(^|\.)apps\.microsoft\.com$/i.test(parsed.hostname) && /^\/detail\//i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function formatRating(value, count) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return null;
  }

  const label = value.toFixed(1);
  return typeof count === "number" && Number.isFinite(count)
    ? `${label} (${new Intl.NumberFormat("zh-CN").format(count)})`
    : label;
}

function Dropdown({ id, label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const [menuPlacement, setMenuPlacement] = useState("bottom");
  const [menuMaxHeight, setMenuMaxHeight] = useState(null);
  const rootRef = useRef(null);
  const controlRef = useRef(null);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);
  const itemRefs = useRef([]);

  const selectedIndex = Math.max(options.findIndex((option) => option.value === value), 0);
  const selectedOption = options[selectedIndex] || options[0];

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handlePointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextIndex = Math.max(options.findIndex((option) => option.value === value), 0);
    requestAnimationFrame(() => {
      itemRefs.current[nextIndex]?.focus();
    });
  }, [open, options, value]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const syncMenuLayout = () => {
      if (!controlRef.current) {
        return;
      }

      const edgePadding = 12;
      const controlRect = controlRef.current.getBoundingClientRect();
      const menuHeight = menuRef.current?.offsetHeight || 220;
      const spaceBelow = window.innerHeight - controlRect.bottom - edgePadding;
      const spaceAbove = controlRect.top - edgePadding;
      const nextPlacement = spaceBelow >= Math.min(menuHeight, 220) || spaceBelow >= spaceAbove
        ? "bottom"
        : "top";
      const availableHeight = Math.max(0, Math.floor(nextPlacement === "bottom" ? spaceBelow : spaceAbove));

      setMenuPlacement(nextPlacement);
      setMenuMaxHeight(availableHeight ? `${availableHeight}px` : null);
    };

    const rafId = requestAnimationFrame(syncMenuLayout);
    window.addEventListener("resize", syncMenuLayout);
    window.addEventListener("scroll", syncMenuLayout, true);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", syncMenuLayout);
      window.removeEventListener("scroll", syncMenuLayout, true);
    };
  }, [open, options.length]);

  const commitSelection = (nextValue) => {
    onChange(nextValue);
    setOpen(false);
    requestAnimationFrame(() => {
      triggerRef.current?.focus();
    });
  };

  const focusItem = (index) => {
    itemRefs.current[index]?.focus();
  };

  const moveFocus = (direction) => {
    const currentIndex = itemRefs.current.findIndex((node) => node === document.activeElement);
    const fallbackIndex = Math.max(options.findIndex((option) => option.value === value), 0);
    const startIndex = currentIndex === -1 ? fallbackIndex : currentIndex;
    const nextIndex = (startIndex + direction + options.length) % options.length;
    focusItem(nextIndex);
  };

  const handleTriggerKeyDown = (event) => {
    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp":
      case "Enter":
      case " ":
        event.preventDefault();
        setOpen((current) => !current || event.key === "ArrowDown" || event.key === "ArrowUp");
        break;
      default:
        break;
    }
  };

  const handleItemKeyDown = (index, event) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveFocus(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveFocus(-1);
        break;
      case "Home":
        event.preventDefault();
        focusItem(0);
        break;
      case "End":
        event.preventDefault();
        focusItem(options.length - 1);
        break;
      case "Tab":
        setOpen(false);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commitSelection(options[index].value);
        break;
      default:
        break;
    }
  };

  return (
    <div ref={rootRef} className={cn("dropdown", open && "is-open", menuPlacement === "top" && "menu-top")}>
      <label htmlFor={`${id}-trigger`}>{label}</label>
      <div ref={controlRef} className="dropdown-control">
        <button
          id={`${id}-trigger`}
          ref={triggerRef}
          className="dropdown-trigger"
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={`${id}-menu`}
          onClick={() => setOpen((current) => !current)}
          onKeyDown={handleTriggerKeyDown}
        >
          <span className="dropdown-trigger-label">{selectedOption?.label || ""}</span>
          <span className="dropdown-trigger-caret" aria-hidden="true"></span>
        </button>
        {open ? (
          <div
            id={`${id}-menu`}
            ref={menuRef}
            className="dropdown-menu"
            role="listbox"
            aria-label={label}
            style={menuMaxHeight ? { maxHeight: menuMaxHeight } : undefined}
          >
            {options.map((option, index) => {
              const selected = option.value === value;
              return (
                <button
                  key={option.value}
                  ref={(node) => {
                    itemRefs.current[index] = node;
                  }}
                  className={cn("dropdown-item", selected && "is-selected")}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => commitSelection(option.value)}
                  onKeyDown={(event) => handleItemKeyDown(index, event)}
                >
                  <span className="dropdown-item-label">{option.label}</span>
                  <span className="dropdown-item-check" aria-hidden="true"></span>
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function App() {
  const storeApi = useMemo(() => getStoreApi(), []);
  const [url, setUrl] = useState(DEFAULT_STORE_URL);
  const [ring, setRing] = useState("Retail");
  const [lang, setLang] = useState("zh-CN");
  const [region, setRegion] = useState("CN");
  const [status, setStatus] = useState({
    message: "等待输入应用链接。",
    kind: ""
  });
  const [appPreview, setAppPreview] = useState({
    status: "idle",
    message: "识别到 Microsoft Store 详情链接后，会自动加载应用名称、图标和详情。",
    data: null
  });
  const [previewExpanded, setPreviewExpanded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [windowPreview, setWindowPreview] = useState(false);
  const previewRequestRef = useRef(0);
  const [windowState, setWindowState] = useState({
    focused: true,
    maximized: false,
    minimizable: true,
    maximizable: true,
    closable: true
  });

  useEffect(() => {
    if (!window.storeApi) {
      setStatus({
        message: "当前为界面预览模式，请在桌面应用中执行查询。",
        kind: ""
      });
    }
  }, []);

  useEffect(() => {
    const controls = storeApi.windowControls;
    if (!controls) {
      setWindowPreview(true);
      return undefined;
    }

    setWindowPreview(false);
    let active = true;

    controls.getState().then((nextState) => {
      if (active) {
        setWindowState((current) => ({ ...current, ...nextState }));
      }
    }).catch(() => {});

    const unsubscribe = controls.onStateChange((nextState) => {
      setWindowState((current) => ({ ...current, ...nextState }));
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [storeApi]);

  useEffect(() => {
    document.body.dataset.windowFocused = windowState.focused === false ? "false" : "true";
    document.body.dataset.windowMaximized = windowState.maximized ? "true" : "false";
    document.body.dataset.windowPreview = windowPreview ? "true" : "false";
  }, [windowPreview, windowState]);

  useEffect(() => {
    const controls = storeApi.windowControls;
    if (!controls?.fitContent || windowPreview) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      controls.fitContent().catch(() => {});
    }, 80);

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    appPreview.data,
    appPreview.status,
    previewExpanded,
    result?.files.length,
    storeApi,
    windowPreview
  ]);

  useEffect(() => {
    const trimmedUrl = url.trim();
    const trimmedRegion = region.trim();
    const requestId = previewRequestRef.current + 1;
    previewRequestRef.current = requestId;

    if (!trimmedUrl) {
      setAppPreview({
        status: "idle",
        message: "识别到 Microsoft Store 详情链接后，会自动加载应用名称、图标和详情。",
        data: null
      });
      return undefined;
    }

    if (!isSupportedStoreUrl(trimmedUrl)) {
      setAppPreview({
        status: "idle",
        message: "当前链接不是 Microsoft Store 应用详情页，暂时无法自动识别。",
        data: null
      });
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setAppPreview((current) => ({
        status: "loading",
        message: current.data ? "正在更新应用信息..." : "正在读取应用信息...",
        data: current.data
      }));

      storeApi.fetchAppMetadata({
        url: trimmedUrl,
        lang,
        gl: trimmedRegion
      }).then((data) => {
        if (previewRequestRef.current !== requestId) {
          return;
        }

        setAppPreview({
          status: "ready",
          message: "",
          data
        });
      }).catch((error) => {
        if (previewRequestRef.current !== requestId) {
          return;
        }

        setAppPreview({
          status: "error",
          message: error?.message || "无法自动读取该应用的详情信息。",
          data: null
        });
      });
    }, 420);

    return () => {
      window.clearTimeout(timer);
    };
  }, [lang, region, storeApi, url]);

  const performWindowAction = async (action) => {
    const controls = storeApi.windowControls;
    if (!controls) {
      return;
    }

    try {
      const nextState = await controls.perform(action);
      setWindowState((current) => ({ ...current, ...nextState }));
    } catch {
      // Ignore temporary control failures and keep the current UI state.
    }
  };

  const openStoreEntry = async () => {
    const rawUrl = url.trim();
    const targetUrl = rawUrl || `https://apps.microsoft.com/home?hl=${encodeURIComponent(lang)}&gl=${encodeURIComponent(region)}`;
    await storeApi.openExternal(targetUrl);
  };

  const queryFiles = async () => {
    const payload = {
      url: url.trim(),
      ring,
      lang: lang.trim(),
      gl: region.trim()
    };

    if (!payload.url) {
      setStatus({
        message: "请输入 Microsoft Store 链接。",
        kind: "error"
      });
      return;
    }

    setSubmitting(true);
    setStatus({
      message: "正在获取文件列表...",
      kind: ""
    });

    try {
      const data = await storeApi.queryFiles(payload);
      setResult({
        categoryId: data.categoryId || "未返回",
        files: data.files || [],
        ring: payload.ring,
        lang: payload.lang,
        region: payload.gl
      });
      setStatus({
        message: `查询完成，共找到 ${data.files.length} 个文件。`,
        kind: "ok"
      });
    } catch (error) {
      setStatus({
        message: error?.message || "请求失败。",
        kind: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const previewRating = formatRating(appPreview.data?.ratingValue, appPreview.data?.ratingCount);
  const hasPreviewDetails = Boolean(
    appPreview.data?.operatingSystem
    || appPreview.data?.description
    || appPreview.data?.websiteUrl
  );

  return (
    <>
      <div className="window-chrome">
        <div className="window-drag" onDoubleClick={() => void performWindowAction("toggle-maximize")}>
          <div className="window-brand">
            <img className="window-brand-icon" src={windowIcon} alt="" />
            <div className="window-brand-copy">
              <strong>StoreApiTool</strong>
              <span>Desktop</span>
            </div>
          </div>
        </div>
        <div className="window-controls" aria-label="窗口控制">
          <button
            id="window-minimize"
            className="window-control"
            type="button"
            aria-label="最小化窗口"
            title="最小化"
            disabled={windowState.minimizable === false}
            onClick={() => void performWindowAction("minimize")}
          >
            <span className="window-control-icon icon-minimize" aria-hidden="true"></span>
          </button>
          <button
            id="window-maximize"
            className="window-control"
            type="button"
            aria-label={windowState.maximized ? "还原窗口" : "最大化窗口"}
            title={windowState.maximized ? "还原" : "最大化"}
            disabled={windowState.maximizable === false}
            onClick={() => void performWindowAction("toggle-maximize")}
          >
            <span className="window-control-icon icon-maximize" aria-hidden="true"></span>
          </button>
          <button
            id="window-close"
            className="window-control window-control-close"
            type="button"
            aria-label="关闭窗口"
            title="关闭"
            disabled={windowState.closable === false}
            onClick={() => void performWindowAction("close")}
          >
            <span className="window-control-icon icon-close" aria-hidden="true"></span>
          </button>
        </div>
      </div>

      <div className="app-shell-scroll">
        <div className="app-shell">
          <header className="panel topbar">
            <div className="brand-copy">
              <h1>微软商店应用安装包下载工具</h1>
              <p>面向桌面用户的 Microsoft Store 应用安装包查询工具，输入应用链接即可获取对应的可下载文件列表。</p>
            </div>
            <div className="brand-meta">
              <span className="meta-chip">by Noah0115</span>
            </div>
          </header>

          <main className="workspace-layout">
            <div className="workspace-main">
              <section className="panel guide-panel" aria-label="使用说明">
                <div className="section-copy compact">
                  <h2>使用说明</h2>
                  <p>按照 4 个步骤完成查询。</p>
                </div>
                <div className="guide-steps">
                  {GUIDE_STEPS.map((step, index) => (
                    <article key={step.title} className="guide-step">
                      <span className="guide-step-number">{index + 1}</span>
                      <div>
                        <h3>{step.title}</h3>
                        <p>{step.description}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="panel workspace-panel">
                <div className="section-head">
                  <div className="section-copy">
                    <h2>查询工作台</h2>
                    <p>支持按发布通道、语言和地区筛选结果，适合快速获取安装包下载地址。</p>
                  </div>
                  <div className={cn("status", status.kind)}>{status.message}</div>
                </div>

                <form className="query-stack" noValidate onSubmit={(event) => {
                  event.preventDefault();
                  void queryFiles();
                }}>
                  <div className="field field-url">
                    <label htmlFor="url">Microsoft Store 链接</label>
                    <div className="input-shell">
                      <span className="input-addon">应用链接</span>
                      <input
                        id="url"
                        value={url}
                        placeholder="https://apps.microsoft.com/detail/..."
                        onChange={(event) => setUrl(event.target.value)}
                      />
                      <button
                        id="open-store"
                        className="secondary-button input-suffix-button"
                        type="button"
                        onClick={() => {
                          openStoreEntry().catch((error) => {
                            setStatus({
                              message: error?.message || "打开 Microsoft Store 失败。",
                              kind: "error"
                            });
                          });
                        }}
                      >
                        打开 Microsoft Store
                      </button>
                    </div>
                    {appPreview.message ? (
                      <div className={cn("field-hint", appPreview.status === "error" && "error")}>{appPreview.message}</div>
                    ) : null}
                  </div>

                  {appPreview.status !== "idle" || appPreview.data ? (
                    <section className={cn("store-preview", appPreview.status)}>
                      <div className="store-preview-media">
                        {appPreview.data?.image ? (
                          <img src={appPreview.data.image} alt="" />
                        ) : (
                          <div className="store-preview-placeholder">应用</div>
                        )}
                      </div>
                      <div className="store-preview-body">
                        <Collapsible open={previewExpanded} onOpenChange={setPreviewExpanded}>
                          <div className="store-preview-head">
                            <div className="store-preview-copy">
                              <h3>{appPreview.data?.title || (appPreview.status === "error" ? "无法自动读取应用详情" : "正在识别应用信息")}</h3>
                              <p>{appPreview.data?.developer || (appPreview.status === "error" ? appPreview.message : "Microsoft Store 应用详情")}</p>
                            </div>
                            <div className="store-preview-aside">
                              {previewRating ? <div className="store-preview-rating">评分 {previewRating}</div> : null}
                              {hasPreviewDetails ? (
                                <CollapsibleTrigger asChild>
                                  <button
                                    className="secondary-button store-preview-toggle"
                                    type="button"
                                  >
                                    <span>{previewExpanded ? "收起信息" : "展开信息"}</span>
                                    <span className="store-preview-toggle-caret" aria-hidden="true"></span>
                                  </button>
                                </CollapsibleTrigger>
                              ) : null}
                            </div>
                          </div>

                          {hasPreviewDetails ? (
                            <CollapsibleContent className="store-preview-details">
                              {appPreview.data?.operatingSystem ? (
                                <div className="store-preview-meta">
                                  <span className="preview-pill">{appPreview.data.operatingSystem}</span>
                                </div>
                              ) : null}

                              {appPreview.data?.description ? (
                                <p className="store-preview-description">{appPreview.data.description}</p>
                              ) : null}

                              {appPreview.data?.websiteUrl ? (
                                <div className="store-preview-actions">
                                  <button
                                    className="secondary-button preview-action"
                                    type="button"
                                    onClick={() => void storeApi.openExternal(appPreview.data.websiteUrl)}
                                  >
                                    打开官网
                                  </button>
                                </div>
                              ) : null}
                            </CollapsibleContent>
                          ) : null}
                        </Collapsible>
                      </div>
                    </section>
                  ) : null}

                  <div className="controls-grid">
                    <div className="field">
                      <Dropdown id="ring" label="发布通道" value={ring} options={RING_OPTIONS} onChange={setRing} />
                    </div>
                    <div className="field field-lang">
                      <Dropdown id="lang" label="语言" value={lang} options={LANGUAGE_OPTIONS} onChange={setLang} />
                    </div>
                    <div className="field">
                      <Dropdown id="gl" label="地区" value={region} options={REGION_OPTIONS} onChange={setRegion} />
                    </div>
                    <div className="field action">
                      <label className="field-spacer" aria-hidden="true">操作</label>
                      <button id="submit" className={cn("primary-action", submitting && "loading")} type="submit" disabled={submitting}>
                        {submitting ? "查询中..." : "查询文件"}
                      </button>
                    </div>
                  </div>
                </form>
              </section>
            </div>
          </main>

          {result ? (
            <section className="panel result-panel">
              <div className="result-head">
                <div className="section-copy">
                  <h2>文件列表</h2>
                  <p>查询结果包含文件名、过期时间、校验值与文件大小。</p>
                </div>
                <div className="meta">
                  <div className="pill">分类 <strong>{result.categoryId}</strong></div>
                  <div className="pill">发布通道 <strong>{result.ring}</strong></div>
                  <div className="pill">语言 <strong>{result.lang}</strong></div>
                  <div className="pill">地区 <strong>{result.region}</strong></div>
                  <div className="pill pill-primary pill-count">文件数量 <strong>{result.files.length}</strong></div>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>文件名</th>
                      <th>过期时间</th>
                      <th>校验值 (SHA-1)</th>
                      <th>大小</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.files.map((file) => (
                      <tr key={`${file.file}-${file.url}`}>
                        <td>{file.file}</td>
                        <td>{file.expire}</td>
                        <td>{file.sha1}</td>
                        <td>{file.size}</td>
                        <td>
                          <button className="link-button" type="button" onClick={() => void storeApi.openExternal(file.url)}>
                            下载
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
