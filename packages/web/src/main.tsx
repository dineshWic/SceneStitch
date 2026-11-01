import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Player, type PlayerRef } from '@remotion/player';
import { MainComposition } from '@scenestitch/composition';
import {
  audioClips,
  autoAssign,
  buildFrameTimeline,
  importPlan,
  musicDbAt,
  parseTimelineTable,
  ProjectSchema,
  projectWarnings,
  rippleEnd,
  validateTimeline,
  type Project,
  type Scene,
  type Asset,
} from '@scenestitch/core';
import './style.css';
type Stored = Project & { id: string };
type Job = {
  id: string;
  status: string;
  progress: number;
  logs: string[];
  output?: string;
  verification?: unknown;
};
async function api<T>(
  url: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
): Promise<T> {
  const response = await fetch(`/api${url}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const error = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(error.error ?? response.statusText);
  }
  return response.status === 204 ? (undefined as T) : (response.json() as Promise<T>);
}
const fileUrl = (id: string, path: string) =>
  `/api/projects/${id}/files/${path.replace(/\\/g, '/').split('/').map(encodeURIComponent).join('/')}`;
const NumberField = ({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) => (
  <label>
    {label}
    <input
      type="number"
      step="0.01"
      min={min}
      max={max}
      value={value}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
    />
  </label>
);
function App() {
  const [projects, setProjects] = useState<Stored[]>([]);
  const [project, setProject] = useState<Stored>();
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState('');
  const [busy, setBusy] = useState(false);
  const [safe, setSafe] = useState(true);
  const [ripple, setRipple] = useState(true);
  const [planText, setPlanText] = useState<string | null>(null);
  const [draft, setDraft] = useState<Project>();
  const [draftText, setDraftText] = useState('');
  useEffect(() => {
    setDraftText(draft ? JSON.stringify(draft.scenes, null, 2) : '');
  }, [draft]);
  const [cloud, setCloud] = useState(false);
  const [job, setJob] = useState<Job>();
  const [exportHistory, setExportHistory] = useState<Job[]>([]);
  const [setup, setSetup] = useState<{
    checks: Array<{ name: string; ok: boolean; detail: string }>;
    freeBytes: number;
  }>();
  const [snapshots, setSnapshots] = useState<string[] | null>(null);
  const player = useRef<PlayerRef>(null);
  const history = useRef<{ past: Stored[]; future: Stored[] }>({ past: [], future: [] });
  const current = useRef(project);
  current.current = project;
  const saveQueue = useRef(Promise.resolve());
  const lastSaved = useRef('');
  const fail = useCallback(
    (error: unknown) => setMessage(error instanceof Error ? error.message : String(error)),
    [],
  );
  const refresh = useCallback(async () => {
    setProjects(await api<Stored[]>('/projects'));
  }, []);
  useEffect(() => {
    void refresh().catch(fail);
    void api<typeof setup>('/setup').then(setSetup).catch(fail);
  }, [refresh, fail]);
  const open = (p: Stored) => {
    setJob(undefined);
    lastSaved.current = JSON.stringify(p);
    setProject(p);
    setSelected(0);
    history.current = { past: [], future: [] };
    setSaved('Saved');
  };
  const edit = (update: (p: Stored) => void) => {
    const before = current.current;
    if (!before) return;
    const next = structuredClone(before);
    update(next);
    history.current.past.push(before);
    history.current.past = history.current.past.slice(-100);
    history.current.future = [];
    current.current = next;
    setProject(next);
    setSaved('Unsaved');
  };
  const undo = () => {
    const old = history.current.past.pop();
    if (!old || !current.current) return;
    history.current.future.push(current.current);
    current.current = old;
    setProject(old);
  };
  const redo = () => {
    const next = history.current.future.pop();
    if (!next || !current.current) return;
    history.current.past.push(current.current);
    current.current = next;
    setProject(next);
  };
  const save = useCallback(async (p: Stored) => {
    const serialized = JSON.stringify(p);
    saveQueue.current = saveQueue.current
      .catch(() => {})
      .then(async () => {
        await api(`/projects/${p.id}`, p, 'PUT');
        lastSaved.current = serialized;
        if (JSON.stringify(current.current) === serialized) setSaved('Saved');
        if (localStorage.getItem(`scenestitch-recovery-${p.id}`) === serialized)
          localStorage.removeItem(`scenestitch-recovery-${p.id}`);
      });
    await saveQueue.current;
  }, []);
  useEffect(() => {
    let active = true;
    if (!project) {
      setExportHistory([]);
      return;
    }
    void api<Array<Job & { projectId: string }>>('/jobs')
      .then((jobs) => {
        if (active)
          setExportHistory(jobs.filter((item) => item.projectId === project.id).reverse());
      })
      .catch(fail);
    return () => {
      active = false;
    };
  }, [project?.id, job?.status, fail]);
  useEffect(() => {
    if (!project || JSON.stringify(project) === lastSaved.current) return;
    localStorage.setItem(`scenestitch-recovery-${project.id}`, JSON.stringify(project));
    const timer = setTimeout(() => {
      void save(project).catch(fail);
    }, 650);
    return () => clearTimeout(timer);
  }, [project, save, fail]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.matches('input,textarea,select,[contenteditable]')) return;
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (current.current) void save(current.current).catch(fail);
      } else if (e.code === 'Space' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        player.current?.toggle();
      } else if (e.key === 'ArrowRight')
        player.current?.seekTo(player.current.getCurrentFrame() + 1);
      else if (e.key === 'ArrowLeft')
        player.current?.seekTo(Math.max(0, player.current.getCurrentFrame() - 1));
      else if (e.key.toLowerCase() === 'j') setSelected((n) => Math.max(0, n - 1));
      else if (e.key.toLowerCase() === 'l')
        setSelected((n) => Math.min((current.current?.scenes.length ?? 1) - 1, n + 1));
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  useEffect(() => {
    if (project?.scenes[selected])
      player.current?.seekTo(Math.round(project.scenes[selected]!.start * project.settings.fps));
  }, [selected, project?.id]);
  useEffect(() => {
    if (!job || !['queued', 'running'].includes(job.status)) return;
    const timer = setInterval(() => {
      void api<Job>(`/jobs/${job.id}`).then(setJob).catch(fail);
    }, 600);
    return () => clearInterval(timer);
  }, [job, fail]);
  const computed = useMemo(
    () => (project ? buildFrameTimeline(project.scenes, project.settings.fps) : { totalFrames: 0 }),
    [project],
  );
  const preview = useMemo(
    () =>
      project
        ? {
            ...project,
            assets: project.assets.map((a) => ({
              ...a,
              path: new URL(fileUrl(project.id, a.path), location.href).href,
            })),
          }
        : undefined,
    [project],
  );
  const warnings = useMemo(() => (project ? projectWarnings(project) : []), [project]);
  const scene = project?.scenes[selected];
  const audio = project?.assets.filter((a) => a.type === 'audio') ?? [];
  const visual = project?.assets.filter((a) => a.type !== 'audio') ?? [];
  const updateScene = (update: (s: Scene) => void) =>
    edit((p) => {
      if (p.scenes[selected]) update(p.scenes[selected]!);
    });
  const chooseAsset = (assetId: string) =>
    updateScene((s) => {
      s.visual = {
        assetId,
        fit: s.visual?.fit ?? project!.settings.defaultFit,
        crop: s.visual?.crop ?? 'cover',
        inPoint: s.visual?.inPoint ?? 0,
        motion: s.visual?.motion,
      };
    });
  const upload = async (files: FileList | File[]) => {
    if (!project) return;
    setBusy(true);
    try {
      await save(current.current!);
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append('file', file);
        const response = await fetch(`/api/projects/${project.id}/assets`, {
          method: 'POST',
          body: form,
        });
        if (!response.ok) {
          const result = (await response.json()) as { error?: string };
          throw new Error(result.error ?? `Import failed: ${file.name}`);
        }
      }
      const fresh = await api<Stored>(`/projects/${project.id}`);
      open({ ...autoAssign(fresh), id: fresh.id });
      // Save auto-assignment explicitly because opening establishes the saved baseline.
      await save({ ...autoAssign(fresh), id: fresh.id });
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };
  const addScene = () =>
    edit((p) => {
      const start = p.scenes.at(-1)?.end ?? 0;
      p.scenes.push({
        id: crypto.randomUUID(),
        label: `Scene ${p.scenes.length + 1}`,
        start,
        end: start + 3,
      });
      setSelected(p.scenes.length - 1);
    });
  const reorder = (index: number, delta: number) =>
    edit((p) => {
      const other = index + delta;
      if (other < 0 || other >= p.scenes.length) return;
      const [item] = p.scenes.splice(index, 1);
      p.scenes.splice(other, 0, item!);
      let start = 0;
      for (const s of p.scenes) {
        const duration = s.end - s.start;
        s.start = start;
        s.end = start + duration;
        start = s.end;
      }
      setSelected(other);
    });
  const options = (assets: Asset[]) => (
    <>
      <option value="">None</option>
      {assets.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name ?? a.id}
        </option>
      ))}
    </>
  );
  return (
    <>
      <header>
        <div className="brand">
          ▰ <strong>SceneStitch</strong>
          <span>LOCAL VIDEO STUDIO</span>
        </div>
        <div className="toolbar">
          <select
            aria-label="Open project"
            disabled={busy}
            value={project?.id ?? ''}
            onChange={(e) => {
              const p = projects.find((p) => p.id === e.target.value);
              if (p) {
                const recovery = localStorage.getItem(`scenestitch-recovery-${p.id}`);
                if (recovery && confirm('Recover unsaved edits from this browser?')) {
                  try {
                    const recovered = { ...ProjectSchema.parse(JSON.parse(recovery)), id: p.id };
                    open(recovered);
                    void save(recovered).catch(fail);
                  } catch (error) {
                    fail(error);
                  }
                } else {
                  const pending = current.current ? save(current.current) : Promise.resolve();
                  void pending
                    .then(() => api<Stored>(`/projects/${p.id}`))
                    .then(open)
                    .catch(fail);
                }
              }
            }}
          >
            <option value="">Open project…</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              const name = prompt('Project name', 'Untitled video');
              if (name)
                void api<Stored>('/projects', { name })
                  .then((p) => {
                    open(p);
                    return refresh();
                  })
                  .catch(fail);
            }}
          >
            + New
          </button>
          <button
            disabled={!project}
            onClick={() => {
              if (project)
                void save(project)
                  .then(() => api<Stored>(`/projects/${project.id}/duplicate`, {}))
                  .then((p) => {
                    open(p);
                    return refresh();
                  })
                  .catch(fail);
            }}
          >
            Duplicate
          </button>
          <button
            disabled={!project}
            onClick={() => {
              if (project && confirm(`Delete ${project.name}?`))
                void api(`/projects/${project.id}`, undefined, 'DELETE')
                  .then(() => {
                    setProject(undefined);
                    return refresh();
                  })
                  .catch(fail);
            }}
          >
            Delete
          </button>
          <button
            disabled={!project}
            onClick={() => {
              if (project)
                void save(project)
                  .then(() => api(`/projects/${project.id}/template`, {}))
                  .then(refresh)
                  .catch(fail);
            }}
          >
            Save template
          </button>
          <span className="status">{saved}</span>
        </div>
      </header>
      {message && (
        <div role="alert" className="alert">
          {message}
          <button onClick={() => setMessage('')}>Dismiss</button>
        </div>
      )}
      {setup?.checks.some((c) => !c.ok) && (
        <div className="alert">
          Setup required:{' '}
          {setup.checks
            .filter((c) => !c.ok)
            .map((c) => c.detail)
            .join(' · ')}
        </div>
      )}
      {!project ? (
        <main className="welcome">
          <span className="eyebrow">YOUR NEXT SHORT STARTS HERE</span>
          <h1>
            Turn your scenes
            <br />
            into a story.
          </h1>
          <p>
            Import your media, shape the timeline, and export a finished vertical video.
            <br />
            Your projects and media stay on this computer.
          </p>
          <button
            className="primary"
            onClick={() => {
              void api<Stored>('/projects', { name: 'My first video' })
                .then((p) => {
                  open(p);
                  return refresh();
                })
                .catch(fail);
            }}
          >
            Create a project
          </button>
        </main>
      ) : (
        <>
          <main className={`editor ${busy ? 'busy' : ''}`} aria-busy={busy}>
            <aside className="library">
              <div className="panel-title">
                Media library <span>{project.assets.length}</span>
              </div>
              <label
                className="dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  void upload(e.dataTransfer.files);
                }}
              >
                ＋<strong>{busy ? 'Importing media…' : 'Drop your media here'}</strong>
                <span>Images, video & audio</span>
                <input
                  aria-label="Import media"
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/*"
                  disabled={busy}
                  onChange={(e) => {
                    if (e.target.files) void upload(e.target.files);
                    e.target.value = '';
                  }}
                />
              </label>
              {project.assets.map((a) => (
                <details
                  key={a.id}
                  className="asset"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/asset-id', a.id)}
                >
                  <summary>
                    {a.thumbnail && <img src={fileUrl(project.id, a.thumbnail)} alt="" />}
                    <span>
                      {a.name ?? a.id}
                      <small>
                        {a.type} {a.duration ? `${a.duration.toFixed(1)}s` : ''}
                      </small>
                    </span>
                  </summary>
                  {a.peaks && (
                    <svg
                      viewBox="0 0 200 40"
                      style={{ width: '100%', height: 40 }}
                      aria-label="Audio waveform"
                    >
                      <polyline
                        fill="none"
                        stroke="#b8c98c"
                        strokeWidth="1"
                        points={a.peaks
                          .map((peak, i) => `${(i * 200) / a.peaks!.length},${20 - peak * 19}`)
                          .join(' ')}
                      />
                      <polyline
                        fill="none"
                        stroke="#b8c98c"
                        strokeWidth="1"
                        points={a.peaks
                          .map((peak, i) => `${(i * 200) / a.peaks!.length},${20 + peak * 19}`)
                          .join(' ')}
                      />
                    </svg>
                  )}
                  {a.type === 'audio' && (
                    <button
                      disabled={busy || !project.scenes.length}
                      onClick={() => {
                        const text = prompt(
                          'Narration timestamps: one start,end line per scene (seconds).',
                          project.scenes.map((s) => `${s.start},${s.end}`).join('\n'),
                        );
                        if (!text) return;
                        const segments = text
                          .split(/\r?\n/)
                          .filter((line) => line.trim())
                          .map((line, i) => {
                            const [start, end] = line.split(',').map(Number);
                            return { sceneId: project.scenes[i]?.id ?? '', start, end };
                          });
                        const trimSilence = confirm(
                          'Trim leading and trailing silence from each extracted narration clip?',
                        );
                        setBusy(true);
                        void save(project)
                          .then(() =>
                            api<Stored>(`/projects/${project.id}/split-voiceover`, {
                              assetId: a.id,
                              segments,
                              trimSilence,
                            }),
                          )
                          .then(open)
                          .catch(fail)
                          .finally(() => setBusy(false));
                      }}
                    >
                      Split narration into scenes
                    </button>
                  )}
                  {a.type === 'audio' && (
                    <>
                      {(['source', 'license', 'licenseUrl'] as const).map((key) => (
                        <label key={key}>
                          {key}
                          <input
                            value={a[key] ?? ''}
                            onChange={(e) =>
                              edit((p) => {
                                p.assets.find((x) => x.id === a.id)![key] = e.target.value;
                              })
                            }
                          />
                        </label>
                      ))}
                      <label>
                        Commercial use
                        <select
                          value={a.commercialUse === undefined ? '' : String(a.commercialUse)}
                          onChange={(e) =>
                            edit((p) => {
                              p.assets.find((x) => x.id === a.id)!.commercialUse =
                                e.target.value === '' ? undefined : e.target.value === 'true';
                            })
                          }
                        >
                          <option value="">Unspecified</option>
                          <option value="true">Allowed</option>
                          <option value="false">Not allowed</option>
                        </select>
                      </label>
                    </>
                  )}
                  <button onClick={() => chooseAsset(a.id)} disabled={a.type === 'audio' || !scene}>
                    Assign to scene
                  </button>
                </details>
              ))}
            </aside>
            <section className="preview">
              <div className="panel-title">
                Preview{' '}
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={safe}
                    onChange={(e) => setSafe(e.target.checked)}
                  />
                  Safe zones
                </label>
              </div>
              <div className="player-wrap">
                {preview && (
                  <Player
                    ref={player}
                    component={MainComposition}
                    inputProps={{ project: preview }}
                    durationInFrames={Math.max(1, computed.totalFrames)}
                    compositionWidth={project.settings.width}
                    compositionHeight={project.settings.height}
                    fps={project.settings.fps}
                    controls
                    style={{ width: '100%', height: '100%' }}
                  />
                )}
                {safe && (
                  <div className="safe-zone" aria-hidden="true">
                    <div>Keep captions above this area</div>
                  </div>
                )}
              </div>
              <div className="preview-meta">
                {project.settings.width} × {project.settings.height}{' '}
                <span>{project.settings.fps} FPS</span>
                <span>
                  {(computed.totalFrames / project.settings.fps).toFixed(2)}s ·{' '}
                  {computed.totalFrames} frames
                </span>
              </div>
              <div className="toolbar">
                <button onClick={undo} disabled={!history.current.past.length}>
                  Undo
                </button>
                <button onClick={redo} disabled={!history.current.future.length}>
                  Redo
                </button>
                <button
                  onClick={() => {
                    void api<string[]>(`/projects/${project.id}/snapshots`)
                      .then(setSnapshots)
                      .catch(fail);
                  }}
                >
                  Saved versions
                </button>
                <button
                  onClick={() => {
                    void save(project).then(refresh).catch(fail);
                  }}
                >
                  Save now
                </button>
              </div>
            </section>
            <aside className="properties">
              <div className="panel-title">
                Scene properties <span>{selected + 1}</span>
              </div>
              {scene ? (
                <>
                  <label>
                    Story beat
                    <input
                      value={scene.label}
                      onChange={(e) =>
                        updateScene((s) => {
                          s.label = e.target.value;
                        })
                      }
                    />
                  </label>
                  <label>
                    Visual
                    <select
                      value={scene.visual?.assetId ?? ''}
                      onChange={(e) => chooseAsset(e.target.value)}
                    >
                      {options(visual)}
                    </select>
                  </label>
                  <label>
                    Fit policy
                    <select
                      value={scene.visual?.fit ?? 'trim'}
                      onChange={(e) =>
                        updateScene((s) => {
                          if (s.visual)
                            s.visual.fit = e.target.value as NonNullable<Scene['visual']>['fit'];
                        })
                      }
                    >
                      {['trim', 'speed', 'loop', 'freeze-last'].map((v) => (
                        <option key={v}>{v}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Crop
                    <select
                      value={scene.visual?.crop ?? 'cover'}
                      onChange={(e) =>
                        updateScene((s) => {
                          if (s.visual) s.visual.crop = e.target.value as 'cover' | 'contain';
                        })
                      }
                    >
                      <option>cover</option>
                      <option>contain</option>
                    </select>
                  </label>
                  <NumberField
                    label="In-point (s)"
                    min={0}
                    value={scene.visual?.inPoint ?? 0}
                    onChange={(n) =>
                      updateScene((s) => {
                        if (s.visual) s.visual.inPoint = n;
                      })
                    }
                  />
                  <div className="two">
                    {(['zoomFrom', 'zoomTo'] as const).map((key) => (
                      <NumberField
                        key={key}
                        label={key === 'zoomFrom' ? 'Zoom from' : 'Zoom to'}
                        min={0.1}
                        value={scene.visual?.motion?.[key] ?? 1}
                        onChange={(n) =>
                          updateScene((s) => {
                            if (s.visual)
                              s.visual.motion = {
                                zoomFrom: s.visual.motion?.zoomFrom ?? 1,
                                zoomTo: s.visual.motion?.zoomTo ?? 1,
                                [key]: n,
                              };
                          })
                        }
                      />
                    ))}
                  </div>
                  <details open>
                    <summary>Captions</summary>
                    <textarea
                      aria-label="Caption text"
                      value={scene.caption?.text ?? ''}
                      placeholder="Tell your story…"
                      onChange={(e) =>
                        updateScene((s) => {
                          s.caption = {
                            text: e.target.value,
                            offset: s.caption?.offset ?? 0.1,
                            style: s.caption?.style ?? 'bigBold',
                            animation: s.caption?.animation,
                          };
                        })
                      }
                    />
                    <NumberField
                      label="Caption offset (s)"
                      value={scene.caption?.offset ?? 0.1}
                      onChange={(n) =>
                        updateScene((s) => {
                          if (s.caption) s.caption.offset = n;
                        })
                      }
                    />
                    <NumberField
                      label="Caption end (scene seconds)"
                      value={scene.caption?.end ?? scene.end - scene.start}
                      onChange={(n) =>
                        updateScene((s) => {
                          if (s.caption) s.caption.end = n;
                        })
                      }
                    />
                    <label>
                      Style
                      <select
                        value={scene.caption?.style ?? 'bigBold'}
                        onChange={(e) =>
                          updateScene((s) => {
                            if (s.caption) s.caption.style = e.target.value;
                          })
                        }
                      >
                        <option value="bigBold">Bold white</option>
                        <option value="yellow">Yellow</option>
                        <option value="boxed">Boxed</option>
                      </select>
                    </label>
                    <label>
                      Entrance
                      <select
                        value={scene.caption?.animation ?? 'pop'}
                        onChange={(e) =>
                          updateScene((s) => {
                            if (s.caption)
                              s.caption.animation = e.target.value as 'none' | 'pop' | 'fade';
                          })
                        }
                      >
                        {['pop', 'fade', 'none'].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                  </details>
                  <details>
                    <summary>Voiceover</summary>
                    <label>
                      Audio
                      <select
                        value={scene.voiceover?.assetId ?? ''}
                        onChange={(e) =>
                          updateScene((s) => {
                            s.voiceover = e.target.value
                              ? { assetId: e.target.value, offset: 0.1 }
                              : undefined;
                          })
                        }
                      >
                        {options(audio)}
                      </select>
                    </label>
                    <NumberField
                      label="Offset (s)"
                      value={scene.voiceover?.offset ?? 0.1}
                      onChange={(n) =>
                        updateScene((s) => {
                          if (s.voiceover) s.voiceover.offset = n;
                        })
                      }
                    />
                    <NumberField
                      label="Playback speed"
                      min={0.5}
                      max={1.1}
                      value={scene.voiceover?.playbackRate ?? 1}
                      onChange={(n) =>
                        updateScene((s) => {
                          if (s.voiceover) s.voiceover.playbackRate = n;
                        })
                      }
                    />
                    <label>
                      Script
                      <textarea
                        value={scene.script ?? ''}
                        onChange={(e) =>
                          updateScene((s) => {
                            s.script = e.target.value;
                          })
                        }
                      />
                    </label>
                  </details>
                  <details>
                    <summary>Sound effects</summary>
                    {scene.sfxNotes && <p>{scene.sfxNotes}</p>}
                    {scene.sfx?.map((sfx, i) => (
                      <div className="sfx" key={i}>
                        <label>
                          Audio
                          <select
                            value={sfx.assetId}
                            onChange={(e) =>
                              updateScene((s) => {
                                s.sfx![i]!.assetId = e.target.value;
                              })
                            }
                          >
                            {options(audio)}
                          </select>
                        </label>
                        {(['offset', 'gainDb', 'fadeIn', 'fadeOut'] as const).map((key) => (
                          <NumberField
                            key={key}
                            label={key}
                            value={sfx[key] ?? 0}
                            onChange={(n) =>
                              updateScene((s) => {
                                s.sfx![i]![key] = n;
                              })
                            }
                          />
                        ))}
                        <button
                          onClick={() =>
                            updateScene((s) => {
                              s.sfx!.splice(i, 1);
                            })
                          }
                        >
                          Remove effect
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() =>
                        updateScene((s) => {
                          (s.sfx ??= []).push({
                            assetId: audio[0]?.id ?? '',
                            offset: 0,
                            gainDb: 0,
                          });
                        })
                      }
                    >
                      + Sound effect
                    </button>
                  </details>
                  <details>
                    <summary>Transition & template</summary>
                    <label>
                      Incoming transition
                      <select
                        value={scene.transitionIn?.type ?? 'cut'}
                        onChange={(e) =>
                          updateScene((s) => {
                            s.transitionIn = { type: e.target.value, duration: 0.25 };
                          })
                        }
                      >
                        {['cut', 'crossfade', 'dip-to-black', 'flash'].map((v) => (
                          <option key={v}>{v}</option>
                        ))}
                      </select>
                    </label>
                    <NumberField
                      label="Transition duration (s)"
                      value={scene.transitionIn?.duration ?? 0.25}
                      min={0.01}
                      onChange={(n) =>
                        updateScene((s) => {
                          if (s.transitionIn) s.transitionIn.duration = n;
                        })
                      }
                    />
                    <label className="inline">
                      <input
                        type="checkbox"
                        checked={!!scene.template}
                        onChange={(e) =>
                          updateScene((s) => {
                            s.template = e.target.checked
                              ? {
                                  type: 'split-screen',
                                  left: { fromScene: project.scenes[0]!.id },
                                  right: {
                                    fromScene: project.scenes[Math.max(0, selected - 1)]!.id,
                                  },
                                }
                              : undefined;
                          })
                        }
                      />
                      Before / after split-screen
                    </label>
                    {scene.template &&
                      (['left', 'right'] as const).map((side) => (
                        <label key={side}>
                          {side} scene
                          <select
                            value={scene.template?.[side]?.fromScene ?? ''}
                            onChange={(e) =>
                              updateScene((s) => {
                                s.template![side] = { fromScene: e.target.value };
                              })
                            }
                          >
                            <option value="">Choose scene</option>
                            {project.scenes
                              .filter((s) => s.id !== scene.id)
                              .map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.label}
                                </option>
                              ))}
                          </select>
                        </label>
                      ))}
                  </details>
                </>
              ) : (
                <p>Add a scene to begin editing.</p>
              )}
            </aside>
          </main>
          <section className="timeline">
            <div className="panel-title">
              Timeline{' '}
              <div className="toolbar">
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={ripple}
                    onChange={(e) => setRipple(e.target.checked)}
                  />
                  Ripple edits
                </label>
                <button onClick={addScene}>+ Scene</button>
                <button
                  onClick={() => {
                    setDraft(undefined);
                    setPlanText('');
                  }}
                >
                  Import plan / table
                </button>
                <button onClick={() => edit((p) => Object.assign(p, autoAssign(p)))}>
                  Auto-assign media
                </button>
              </div>
            </div>
            <div className="lanes">
              <div className="scene-blocks">
                {project.scenes.map((s, i) => (
                  <button
                    key={s.id}
                    className={i === selected ? 'active' : ''}
                    style={{ flex: Math.max(0.1, s.end - s.start) }}
                    onClick={() => setSelected(i)}
                  >
                    {i + 1} · {s.label}
                  </button>
                ))}
              </div>
              {(['voiceover', 'sfx'] as const).map((kind) => (
                <div className="lane" key={kind}>
                  <span>{kind === 'voiceover' ? 'VO' : 'SFX'}</span>
                  {audioClips(project)
                    .filter((c) => c.kind === kind)
                    .map((c, i) => (
                      <i
                        key={i}
                        title={`${c.start.toFixed(2)}s`}
                        style={{
                          left: `${(c.start / Math.max(1, project.scenes.at(-1)?.end ?? 1)) * 100}%`,
                          width: `${(c.duration / Math.max(1, project.scenes.at(-1)?.end ?? 1)) * 100}%`,
                        }}
                      />
                    ))}
                </div>
              ))}
              <div className="lane music-lane">
                <span>MUSIC</span>
                {project.music && (
                  <svg viewBox="0 0 1000 30" preserveAspectRatio="none">
                    <polyline
                      fill="none"
                      stroke="#d1e586"
                      strokeWidth="2"
                      points={Array.from(
                        { length: 201 },
                        (_, i) =>
                          `${i * 5},${Math.max(1, Math.min(29, -musicDbAt(project, (i / 200) * (project.scenes.at(-1)?.end ?? 0)) * 0.7))}`,
                      ).join(' ')}
                    />
                  </svg>
                )}
              </div>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Scene</th>
                    <th>Start (s)</th>
                    <th>End (s)</th>
                    <th>Story beat</th>
                    <th>Visual</th>
                    <th>Order</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {project.scenes.map((s, i) => {
                    const errors = validateTimeline(project.scenes).filter(
                      (e) => e.sceneId === s.id,
                    );
                    return (
                      <tr
                        key={s.id}
                        className={`${i === selected ? 'selected' : ''} ${errors.length ? 'invalid' : ''}`}
                        title={errors.map((e) => e.message).join('\n')}
                        onClick={() => setSelected(i)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          const id = e.dataTransfer.getData('text/asset-id');
                          if (visual.some((a) => a.id === id))
                            edit((p) => {
                              p.scenes[i]!.visual = {
                                assetId: id,
                                fit: p.settings.defaultFit,
                                inPoint: 0,
                                crop: 'cover',
                              };
                            });
                        }}
                      >
                        <td>{i + 1}</td>
                        <td>
                          <input
                            aria-label={`Scene ${i + 1} start`}
                            type="number"
                            step={1 / project.settings.fps}
                            value={s.start}
                            onChange={(e) =>
                              edit((p) => {
                                p.scenes[i]!.start =
                                  Math.round(Number(e.target.value) * p.settings.fps) /
                                  p.settings.fps;
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Scene ${i + 1} end`}
                            type="number"
                            step={1 / project.settings.fps}
                            value={s.end}
                            onChange={(e) =>
                              edit((p) => {
                                const end =
                                  Math.round(Number(e.target.value) * p.settings.fps) /
                                  p.settings.fps;
                                if (ripple) p.scenes = rippleEnd(p.scenes, i, end);
                                else p.scenes[i]!.end = end;
                              })
                            }
                          />
                        </td>
                        <td>
                          <input
                            aria-label={`Scene ${i + 1} label`}
                            value={s.label}
                            onChange={(e) =>
                              edit((p) => {
                                p.scenes[i]!.label = e.target.value;
                              })
                            }
                          />
                          {errors.map((error) => (
                            <small key={error.code}>{error.message}</small>
                          ))}
                        </td>
                        <td>
                          <select
                            aria-label={`Scene ${i + 1} asset`}
                            value={s.visual?.assetId ?? ''}
                            onChange={(e) =>
                              edit((p) => {
                                p.scenes[i]!.visual = {
                                  assetId: e.target.value,
                                  fit: p.settings.defaultFit,
                                  crop: 'cover',
                                  inPoint: 0,
                                };
                              })
                            }
                          >
                            {options(visual)}
                          </select>
                        </td>
                        <td>
                          <button aria-label="Move scene up" onClick={() => reorder(i, -1)}>
                            ↑
                          </button>
                          <button aria-label="Move scene down" onClick={() => reorder(i, 1)}>
                            ↓
                          </button>
                        </td>
                        <td>
                          <button
                            aria-label="Remove scene"
                            onClick={() =>
                              edit((p) => {
                                p.scenes.splice(i, 1);
                                let start = 0;
                                for (const row of p.scenes) {
                                  const duration = row.end - row.start;
                                  row.start = start;
                                  row.end = start + duration;
                                  start = row.end;
                                }
                                setSelected(Math.max(0, i - 1));
                              })
                            }
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
          <section className="bottom-panels">
            <details>
              <summary>Project settings</summary>
              <label>
                Name
                <input
                  value={project.name}
                  onChange={(e) =>
                    edit((p) => {
                      p.name = e.target.value;
                    })
                  }
                />
              </label>
              <div className="two">
                {(['width', 'height', 'fps'] as const).map((key) => (
                  <NumberField
                    key={key}
                    label={key}
                    min={1}
                    value={project.settings[key]}
                    onChange={(n) =>
                      edit((p) => {
                        p.settings[key] = n;
                      })
                    }
                  />
                ))}
              </div>
              <label>
                Default fit
                <select
                  value={project.settings.defaultFit}
                  onChange={(e) =>
                    edit((p) => {
                      p.settings.defaultFit = e.target.value as Project['settings']['defaultFit'];
                    })
                  }
                >
                  {['trim', 'speed', 'loop', 'freeze-last'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
            </details>
            <details>
              <summary>Music & mixing</summary>
              <label>
                Music track
                <select
                  value={project.music?.assetId ?? ''}
                  onChange={(e) =>
                    edit((p) => {
                      p.music = e.target.value
                        ? {
                            assetId: e.target.value,
                            baseDb: -18,
                            duckDb: -6,
                            attack: 0.15,
                            release: 0.35,
                            fadeOut: 1.5,
                          }
                        : undefined;
                    })
                  }
                >
                  {options(audio)}
                </select>
              </label>
              {project.music && (
                <>
                  {(
                    [
                      'inPoint',
                      'baseDb',
                      'duckDb',
                      'attack',
                      'release',
                      'fadeIn',
                      'fadeOut',
                    ] as const
                  ).map((key) => (
                    <NumberField
                      key={key}
                      label={key}
                      value={project.music?.[key] ?? 0}
                      onChange={(n) =>
                        edit((p) => {
                          p.music![key] = n;
                        })
                      }
                    />
                  ))}
                  {project.music.overrides?.map((o, i) => (
                    <div className="two" key={i}>
                      {(['start', 'end', 'gainDb'] as const).map((key) => (
                        <NumberField
                          key={key}
                          label={key}
                          value={o[key]}
                          onChange={(n) =>
                            edit((p) => {
                              p.music!.overrides![i]![key] = n;
                            })
                          }
                        />
                      ))}
                      <button
                        onClick={() =>
                          edit((p) => {
                            p.music!.overrides!.splice(i, 1);
                          })
                        }
                      >
                        Remove override
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      edit((p) => {
                        (p.music!.overrides ??= []).push({ start: 0, end: 1, gainDb: -3 });
                      })
                    }
                  >
                    + Gain override
                  </button>
                </>
              )}
            </details>
            <details open>
              <summary>
                Checks <span>{warnings.length}</span>
              </summary>
              <ul>
                {warnings.slice(0, 30).map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
              {warnings.length === 0 && <p>Ready to export.</p>}
            </details>
            <div className="export">
              <h3>Make it a video</h3>
              <label>
                Previous exports
                <select
                  aria-label="Previous exports"
                  value={job?.id ?? ''}
                  onChange={(event) =>
                    setJob(exportHistory.find((item) => item.id === event.target.value))
                  }
                >
                  <option value="">Choose an export…</option>
                  {exportHistory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.status} · {item.id.slice(0, 8)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Platform preset
                <select
                  value={project.export?.preset ?? 'shorts'}
                  onChange={(e) =>
                    edit((p) => {
                      p.export = {
                        preset: e.target.value,
                        loudnessLufs: p.export?.loudnessLufs ?? -14,
                      };
                    })
                  }
                >
                  {['shorts', 'reels', 'tiktok', 'facebook'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <div className="toolbar">
                {[true, false].map((isDraft) => (
                  <button
                    key={String(isDraft)}
                    className={isDraft ? '' : 'primary'}
                    disabled={
                      busy ||
                      !project.scenes.length ||
                      (!!job && ['queued', 'running'].includes(job.status))
                    }
                    onClick={() => {
                      void save(project)
                        .then(() => api<Job>(`/projects/${project.id}/render`, { draft: isDraft }))
                        .then(setJob)
                        .catch(fail);
                    }}
                  >
                    {isDraft ? 'Draft export' : 'Export MP4'}
                  </button>
                ))}
              </div>
              {job && (
                <>
                  <p>
                    {job.status} · {Math.round(job.progress * 100)}%
                  </p>
                  <progress value={job.progress} max={1} />
                  {['queued', 'running'].includes(job.status) && (
                    <button
                      onClick={() => {
                        void api<Job>(`/jobs/${job.id}/cancel`, {}).then(setJob).catch(fail);
                      }}
                    >
                      Cancel
                    </button>
                  )}
                  <pre>{job.logs.join('\n')}</pre>
                  {job.output && (
                    <div className="downloads">
                      {[
                        ['Video', ''],
                        ['Captions', '.srt'],
                        ['Credits', '.credits.txt'],
                        ['Audio mix', '.wav'],
                      ].map(([label, ext]) => (
                        <a key={label} href={`/api${job.output}${ext}`} download>
                          {label} ↓
                        </a>
                      ))}
                    </div>
                  )}
                  {job.verification ? (
                    <details>
                      <summary>Verification</summary>
                      <pre>{JSON.stringify(job.verification, null, 2)}</pre>
                    </details>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </>
      )}
      {planText !== null && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="panel-title">
              Import production plan
              <button
                onClick={() => {
                  setPlanText(null);
                  setDraft(undefined);
                }}
              >
                ×
              </button>
            </div>
            <p>
              Paste a Markdown, CSV or tab-separated timeline, or a plan with Scene headings and
              VOICEOVER / CAPTION / SFX fields. Review before applying.
            </p>
            <input
              aria-label="Upload production plan"
              type="file"
              accept=".md,.txt,.csv,.tsv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void file.text().then(setPlanText).catch(fail);
              }}
            />
            <div className="import-grid">
              <textarea
                aria-label="Production plan"
                value={planText}
                onChange={(e) => {
                  setPlanText(e.target.value);
                  setDraft(undefined);
                }}
              />
              {draft && (
                <textarea
                  aria-label="Review extracted scenes JSON"
                  value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                />
              )}
            </div>
            <label className="inline">
              <input type="checkbox" checked={cloud} onChange={(e) => setCloud(e.target.checked)} />
              Use optional cloud extraction (sends plan text to configured provider)
            </label>
            <div className="toolbar">
              <button
                onClick={() => {
                  if (cloud)
                    void api<{ project: Project; notes: string[] }>('/import-plan', {
                      text: planText,
                      useCloud: true,
                    })
                      .then((r) => {
                        setDraft(r.project);
                        if (r.notes.length) setMessage(r.notes.join('\n'));
                      })
                      .catch(fail);
                  else {
                    const result = importPlan(planText);
                    const table = parseTimelineTable(planText);
                    setDraft(result.project);
                    if (table.errors.length) setMessage(result.notes.join('\n'));
                  }
                }}
              >
                Extract & review
              </button>
              <button
                className="primary"
                disabled={!draft?.scenes.length}
                onClick={() => {
                  if (!draft) return;
                  try {
                    const reviewed = ProjectSchema.parse({
                      ...draft,
                      scenes: JSON.parse(draftText),
                    });
                    edit((p) => {
                      p.scenes = reviewed.scenes;
                    });
                  } catch (error) {
                    fail(error);
                    return;
                  }
                  setDraft(undefined);
                  setPlanText(null);
                }}
              >
                Apply reviewed scenes
              </button>
            </div>
          </section>
        </div>
      )}
      {snapshots && (
        <div className="modal-backdrop">
          <section className="modal">
            <div className="panel-title">
              Saved versions<button onClick={() => setSnapshots(null)}>×</button>
            </div>
            <p>
              Restore a version to recover earlier edits. Your current version is saved before
              restoration.
            </p>
            {snapshots.length ? (
              snapshots.map((name) => (
                <button
                  key={name}
                  onClick={() => {
                    void api<Stored>(`/projects/${project!.id}/snapshots/${name}/restore`, {})
                      .then((p) => {
                        open(p);
                        setSnapshots(null);
                      })
                      .catch(fail);
                  }}
                >
                  {new Date(Number(name.split('-')[0])).toLocaleString()}
                </button>
              ))
            ) : (
              <p>No saved versions yet.</p>
            )}
          </section>
        </div>
      )}
      <footer>
        SceneStitch · Local-first video assembly
        <span>Space play/pause · ← → frame · J / L scene · Ctrl Z / Y undo · Ctrl S save</span>
      </footer>
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
