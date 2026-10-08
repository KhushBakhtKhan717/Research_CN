// All data comes from the backend REST API - nothing is hard-coded here.
const API_URL = '/api/opportunities';

let opportunities = [];
let pendingDeleteId = null;

const $ = (id) => document.getElementById(id);
const detailsModal = new bootstrap.Modal($('detailsModal'));
const formModal = new bootstrap.Modal($('formModal'));
const deleteModal = new bootstrap.Modal($('deleteModal'));

const FORM_FIELDS = ['title', 'description', 'research_area', 'faculty_name', 'department',
  'required_skills', 'available_positions', 'application_deadline', 'status'];

/* ---------- helpers ---------- */
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function showMessage(text, type = 'success') {
  const div = document.createElement('div');
  div.className = `alert alert-${type} alert-dismissible fade show shadow-sm`;
  div.innerHTML = `${text}<button type="button" class="btn-close" data-bs-dismiss="alert"></button>`;
  $('alertBox').appendChild(div);
  setTimeout(() => div.remove(), 5000);
}

async function request(url, options = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });
  } catch (e) {
    throw new Error('Cannot reach the server. Is the backend running?');
  }
  let body = null;
  try { body = await res.json(); } catch (e) { /* no body */ }
  if (!res.ok) {
    const details = body && body.details ? ': ' + body.details.join('; ') : '';
    const err = new Error(((body && body.error) || `Request failed (${res.status})`) + details);
    err.status = res.status;
    throw err;
  }
  return body;
}

function statusBadge(status) {
  return `<span class="badge ${status === 'Open' ? 'bg-success' : 'bg-secondary'}">${escapeHtml(status)}</span>`;
}

/* ---------- list ---------- */
async function loadOpportunities() {
  try {
    opportunities = await request(API_URL);
    renderTable();
  } catch (err) {
    $('tableBody').innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">${escapeHtml(err.message)}</td></tr>`;
    showMessage(escapeHtml(err.message), 'danger');
  }
}

function renderTable() {
  const q = $('searchInput').value.trim().toLowerCase();
  const statusFilter = $('statusFilter').value;
  const rows = opportunities.filter((o) =>
    (!statusFilter || o.status === statusFilter) &&
    (!q || [o.title, o.research_area, o.faculty_name, o.department].some((v) => v.toLowerCase().includes(q))));

  if (rows.length === 0) {
    $('tableBody').innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No research opportunities found.</td></tr>';
    return;
  }

  $('tableBody').innerHTML = rows.map((o) => `
    <tr>
      <td>${o.id}</td>
      <td class="title-cell"><a href="#" class="fw-semibold text-decoration-none" data-action="view" data-id="${o.id}">${escapeHtml(o.title)}</a></td>
      <td>${escapeHtml(o.research_area)}</td>
      <td>${escapeHtml(o.faculty_name)}</td>
      <td>${o.available_positions}</td>
      <td>${escapeHtml(o.application_deadline)}</td>
      <td>${statusBadge(o.status)}</td>
      <td class="text-end">
        <button class="btn btn-sm btn-outline-primary" data-action="view" data-id="${o.id}">View</button>
        <button class="btn btn-sm btn-outline-warning" data-action="edit" data-id="${o.id}">Edit</button>
        ${o.status === 'Open'
          ? `<button class="btn btn-sm btn-outline-secondary" data-action="close" data-id="${o.id}">Close</button>` : ''}
        <button class="btn btn-sm btn-outline-danger" data-action="delete" data-id="${o.id}">Delete</button>
      </td>
    </tr>`).join('');
}

/* ---------- details ---------- */
async function viewOpportunity(id) {
  try {
    const o = await request(`${API_URL}/${id}`);
    const row = (label, value) =>
      `<div class="row mb-2"><div class="col-sm-4 detail-label">${label}</div><div class="col-sm-8">${value}</div></div>`;
    $('detailsBody').innerHTML =
      row('ID', o.id) + row('Title', escapeHtml(o.title)) +
      row('Description', escapeHtml(o.description).replace(/\n/g, '<br>')) +
      row('Research Area', escapeHtml(o.research_area)) + row('Faculty Member', escapeHtml(o.faculty_name)) +
      row('Department', escapeHtml(o.department)) + row('Required Skills', escapeHtml(o.required_skills)) +
      row('Available Positions', o.available_positions) + row('Application Deadline', escapeHtml(o.application_deadline)) +
      row('Status', statusBadge(o.status));
    detailsModal.show();
  } catch (err) {
    showMessage(escapeHtml(err.message), 'danger');
    if (err.status === 404) loadOpportunities();
  }
}

/* ---------- create / edit ---------- */
function openForm(opportunity) {
  const form = $('oppForm');
  form.classList.remove('was-validated');
  form.reset();
  $('oppId').value = opportunity ? opportunity.id : '';
  $('formTitle').textContent = opportunity ? `Edit Opportunity #${opportunity.id}` : 'New Research Opportunity';
  FORM_FIELDS.forEach((f) => { $(f).value = opportunity ? opportunity[f] : ''; });
  if (!opportunity) $('status').value = 'Open';
  formModal.show();
}

$('oppForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;

  // basic validation of required fields
  FORM_FIELDS.forEach((f) => { if (typeof $(f).value === 'string') $(f).value = $(f).value.trim(); });
  form.classList.add('was-validated');
  if (!form.checkValidity()) return;

  const payload = {};
  FORM_FIELDS.forEach((f) => { payload[f] = $(f).value; });
  payload.available_positions = Number(payload.available_positions);

  const id = $('oppId').value;
  $('btnSave').disabled = true;
  try {
    if (id) {
      await request(`${API_URL}/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
      showMessage('Research opportunity updated successfully.');
    } else {
      await request(API_URL, { method: 'POST', body: JSON.stringify(payload) });
      showMessage('Research opportunity created successfully.');
    }
    formModal.hide();
    await loadOpportunities();
  } catch (err) {
    showMessage(escapeHtml(err.message), 'danger');
  } finally {
    $('btnSave').disabled = false;
  }
});

/* ---------- close (Open -> Closed) ---------- */
async function closeOpportunity(id) {
  try {
    await request(`${API_URL}/${id}`, { method: 'PUT', body: JSON.stringify({ status: 'Closed' }) });
    showMessage(`Opportunity #${id} has been closed.`);
    await loadOpportunities();
  } catch (err) {
    showMessage(escapeHtml(err.message), 'danger');
    if (err.status === 404) loadOpportunities();
  }
}

/* ---------- delete ---------- */
function askDelete(id) {
  const o = opportunities.find((x) => x.id === id);
  pendingDeleteId = id;
  $('deleteBody').innerHTML = `Are you sure you want to delete <strong>${escapeHtml(o ? o.title : '#' + id)}</strong>? This cannot be undone.`;
  deleteModal.show();
}

$('btnConfirmDelete').addEventListener('click', async () => {
  try {
    await request(`${API_URL}/${pendingDeleteId}`, { method: 'DELETE' });
    showMessage('Research opportunity deleted successfully.');
  } catch (err) {
    showMessage(escapeHtml(err.message), 'danger');
  }
  deleteModal.hide();
  await loadOpportunities();
});

/* ---------- events ---------- */
$('tableBody').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  e.preventDefault();
  const id = Number(btn.dataset.id);
  const action = btn.dataset.action;
  if (action === 'view') viewOpportunity(id);
  if (action === 'edit') openForm(opportunities.find((o) => o.id === id));
  if (action === 'close') closeOpportunity(id);
  if (action === 'delete') askDelete(id);
});

$('btnNew').addEventListener('click', () => openForm(null));
$('searchInput').addEventListener('input', renderTable);
$('statusFilter').addEventListener('change', renderTable);

loadOpportunities();
