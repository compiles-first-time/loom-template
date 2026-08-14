/* Loom Studio UI — no build step, no framework, no CDN. */
'use strict';

const $ = (id) => document.getElementById(id);
const api = async (path, options = {}) => {
  const resp = await fetch(path, options);
  const body = await resp.json().catch(() => ({}));
  if (!resp.ok) throw new Error(body.detail || body.error || `HTTP ${resp.status}`);
  return body;
};

/* --- uploads ------------------------------------------------------------ */

// Maps a file input to the data-dir-relative paths the job API expects.
const uploaded = new Map();

async function uploadFiles(input, echoEl) {
  const paths = [];
  for (const file of input.files) {
    if (echoEl) echoEl.textContent = `uploading ${file.name}…`;
    const form = new FormData();
    form.append('file', file);
    const result = await api('/api/upload', { method: 'POST', body: form });
    paths.push(result.path);
  }
  uploaded.set(input.id, paths);
  if (echoEl) echoEl.textContent = paths.length ? paths.join(', ') : '';
  return paths;
}

function wireUpload(inputId, echoId, after) {
  const input = $(inputId);
  if (!input) return;
  input.addEventListener('change', async () => {
    try {
      const paths = await uploadFiles(input, $(echoId));
      if (after) after(paths);
    } catch (err) {
      if ($(echoId)) $(echoId).textContent = `upload failed: ${err.message}`;
    }
  });
}

/* --- tabs --------------------------------------------------------------- */

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    $(tab.dataset.panel).classList.add('active');
  });
});

/* --- health + workflows ------------------------------------------------- */

async function refreshHealth() {
  const el = $('health');
  try {
    const health = await api('/api/health');
    const bits = Object.entries(health.backends).map(([name, info]) => {
      const label = name === 'comfyui' && info.ok
        ? `${name} · ${info.device} · ${info.vram_free_gb}/${info.vram_total_gb} GB free`
        : name;
      return `<span class="chip ${info.ok ? 'ok' : 'bad'}" title="${info.error || 'ready'}">${label}</span>`;
    });
    el.innerHTML = bits.join('');
  } catch (err) {
    el.innerHTML = `<span class="chip bad">orchestrator unreachable: ${err.message}</span>`;
  }
}

async function loadWorkflows() {
  const { workflows } = await api('/api/workflows');
  const fill = (selectId, match) => {
    const select = $(selectId);
    if (!select) return;
    select.innerHTML = '';
    workflows
      .filter((w) => match.test(w.name))
      .forEach((w) => {
        const option = document.createElement('option');
        option.value = w.name;
        option.textContent = w.name;
        option.title = w.description || '';
        select.appendChild(option);
      });
    if (!select.options.length) {
      select.innerHTML = '<option value="">(none installed)</option>';
    }
  };
  fill('animate-workflow', /i2v|image|video/i);
  fill('enhance-workflow', /enhance|upscale|interp/i);
}

/* --- timeline clip editor ----------------------------------------------- */

const clips = [];

function renderClips() {
  const list = $('clip-list');
  list.innerHTML = '';
  clips.forEach((clip, index) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <span class="clip-name" title="${clip.source}">${clip.source.split('/').pop()}</span>
      <label>in <input type="number" step="0.1" min="0" value="${clip.start ?? ''}" data-field="start"></label>
      <label>out <input type="number" step="0.1" min="0" value="${clip.end ?? ''}" data-field="end"></label>
      <label>xfade <input type="number" step="0.1" min="0" value="${clip.transition_s}" data-field="transition_s"
        ${index === 0 ? 'disabled title="the first clip has nothing to fade from"' : ''}></label>
      <button data-action="up" ${index === 0 ? 'disabled' : ''}>↑</button>
      <button data-action="down" ${index === clips.length - 1 ? 'disabled' : ''}>↓</button>
      <button data-action="remove">✕</button>`;

    li.querySelectorAll('input').forEach((input) => {
      input.addEventListener('change', () => {
        const raw = input.value.trim();
        const field = input.dataset.field;
        clips[index][field] = raw === ''
          ? (field === 'transition_s' ? 0 : null)
          : Number(raw);
      });
    });

    li.querySelectorAll('button').forEach((button) => {
      button.addEventListener('click', () => {
        const action = button.dataset.action;
        if (action === 'remove') clips.splice(index, 1);
        if (action === 'up') [clips[index - 1], clips[index]] = [clips[index], clips[index - 1]];
        if (action === 'down') [clips[index + 1], clips[index]] = [clips[index], clips[index + 1]];
        renderClips();
      });
    });

    list.appendChild(li);
  });
}

wireUpload('timeline-files', null, (paths) => {
  paths.forEach((p) => clips.push({ source: p, start: null, end: null, transition_s: 0 }));
  renderClips();
});

/* --- job submission ------------------------------------------------------ */

async function submit(kind, params, button) {
  button.disabled = true;
  const original = button.textContent;
  button.textContent = 'queueing…';
  try {
    const job = await api('/api/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, params }),
    });
    watch(job.id);
    await refreshJobs();
  } catch (err) {
    alert(`could not queue job: ${err.message}`);
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

function firstPath(inputId) {
  const paths = uploaded.get(inputId) || [];
  return paths[0] || null;
}

$('animate-go').addEventListener('click', (event) => {
  const image = firstPath('animate-file');
  if (!image) return alert('pick a source image first');
  submit('image_to_video', {
    images: [image],
    prompt: $('animate-prompt').value,
    negative_prompt: $('animate-negative').value || undefined,
    workflow: $('animate-workflow').value || undefined,
    duration_s: Number($('animate-duration').value),
    fps: Number($('animate-fps').value),
    width: Number($('animate-width').value),
    height: Number($('animate-height').value),
    steps: Number($('animate-steps').value),
    cfg: Number($('animate-cfg').value),
    seed: Number($('animate-seed').value),
  }, event.target);
});

$('enhance-go').addEventListener('click', (event) => {
  const source = firstPath('enhance-file');
  if (!source) return alert('pick a source video first');
  submit('enhance', {
    source,
    workflow: $('enhance-workflow').value || undefined,
    interpolation_multiplier: Number($('enhance-mult').value),
    fps: Number($('enhance-fps').value),
  }, event.target);
});

$('swap-go').addEventListener('click', (event) => {
  const sources = uploaded.get('swap-sources') || [];
  const target = firstPath('swap-target');
  if (!sources.length) return alert('pick at least one source face');
  if (!target) return alert('pick a target video');
  submit('face_swap', {
    sources,
    target,
    swapper_model: $('swap-model').value,
    enhancer_model: $('swap-enhancer').value,
    enhancer_blend: Number($('swap-blend').value),
  }, event.target);
});

$('timeline-go').addEventListener('click', (event) => {
  if (!clips.length) return alert('add at least one clip');
  submit('assemble', {
    clips,
    output_name: $('timeline-name').value || 'timeline.mp4',
    crf: Number($('timeline-crf').value),
  }, event.target);
});

/* --- job list ------------------------------------------------------------ */

const watching = new Set();

function watch(jobId) {
  if (watching.has(jobId)) return;
  watching.add(jobId);

  const source = new EventSource(`/api/jobs/${jobId}/events`);
  source.onmessage = (event) => {
    const job = JSON.parse(event.data);
    upsertJob(job);
    if (['succeeded', 'failed', 'cancelled'].includes(job.state)) {
      source.close();
      watching.delete(jobId);
    }
  };
  source.onerror = () => {
    source.close();
    watching.delete(jobId);
  };
}

function jobCard(job) {
  const percent = Math.round((job.progress || 0) * 100);
  const outputs = (job.outputs || []).map((path) => {
    const name = path.split(/[\\/]/).pop();
    const href = `/api/files?path=${encodeURIComponent(path)}`;
    return /\.(mp4|webm|mkv|mov)$/i.test(name)
      ? `<video controls preload="metadata" src="${href}"></video>`
      : `<a href="${href}" target="_blank" rel="noopener">${name}</a>`;
  }).join('');

  const cancellable = ['queued', 'running'].includes(job.state);
  return `
    <article class="job ${job.state}" data-id="${job.id}">
      <div class="job-head">
        <strong>${job.kind}</strong>
        <span class="state">${job.state}</span>
        <span class="stage">${job.stage || ''}</span>
        ${cancellable ? `<button data-cancel="${job.id}">cancel</button>` : ''}
      </div>
      <div class="bar"><div class="fill" style="width:${percent}%"></div></div>
      ${job.error ? `<pre class="error">${escapeHtml(job.error)}</pre>` : ''}
      <div class="outputs">${outputs}</div>
    </article>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function upsertJob(job) {
  const list = $('job-list');
  const existing = list.querySelector(`[data-id="${job.id}"]`);
  const html = jobCard(job);
  if (existing) {
    existing.outerHTML = html;
  } else {
    list.insertAdjacentHTML('afterbegin', html);
  }
  wireCancels();
}

function wireCancels() {
  document.querySelectorAll('[data-cancel]').forEach((button) => {
    if (button.dataset.wired) return;
    button.dataset.wired = '1';
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        await api(`/api/jobs/${button.dataset.cancel}/cancel`, { method: 'POST' });
      } catch (err) {
        alert(err.message);
        button.disabled = false;
      }
    });
  });
}

async function refreshJobs() {
  const { jobs } = await api('/api/jobs?limit=25');
  $('job-list').innerHTML = jobs.map(jobCard).join('') || '<p class="hint">No jobs yet.</p>';
  wireCancels();
  jobs.filter((j) => ['queued', 'running'].includes(j.state)).forEach((j) => watch(j.id));
}

/* --- boot ---------------------------------------------------------------- */

Object.entries({
  'animate-file': 'animate-path',
  'enhance-file': 'enhance-path',
  'swap-sources': 'swap-sources-path',
  'swap-target': 'swap-target-path',
}).forEach(([inputId, echoId]) => wireUpload(inputId, echoId));

refreshHealth();
loadWorkflows().catch(() => {});
refreshJobs().catch(() => {});
setInterval(refreshHealth, 15000);
