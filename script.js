// USE2026 · Consulta de aulas PAU EHU
//
// Versión Material 3 mobile-first (2026).
// - Lee ?codigos=A,B,C de la URL (o ?codigo=A para legacy) y muestra los resultados.
// - Búsqueda manual por input.
// - Bottom nav: Bilatu / Informazioa / Laguntza.
// - Beacon anónimo a Cloudflare Worker (HLL, sin PII, sin body).
// - Renderizado 100% vía DOM API + textContent: el contenido dinámico
//   (URL params, JSON) nunca entra al DOM como HTML.
// - Códigos validados contra regex estricta antes de tocar el JSON.

// ── Beacon a Worker · estadísticas agregadas anónimas ─────────────────
const QR_LOG_URL = 'https://qr-log-tribunal.moxkix.workers.dev';

(function enviarBeacon() {
  if (!QR_LOG_URL) return;
  try {
    fetch(QR_LOG_URL.replace(/\/$/, '') + '/scan', {
      method: 'POST',
      keepalive: true,
    }).catch(() => {});
  } catch (e) { /* silencio: si falla el log no impedimos la consulta */ }
})();

// Formato esperado de los códigos: alfanumérico mayúscula, 2-12 caracteres.
// Cualquier cosa fuera de este patrón (HTML, scripts, símbolos) se rechaza.
const REGEX_CODIGO = /^[A-Z0-9]{2,12}$/;

let CACHE_DATA = null;

async function cargarDatos() {
  if (CACHE_DATA) return CACHE_DATA;
  const response = await fetch('asignaturas_aulas.json');
  if (!response.ok) throw new Error('HTTP ' + response.status);
  CACHE_DATA = await response.json();
  return CACHE_DATA;
}

function bilingue(es, eu) {
  if (!es && !eu) return '';
  if (es === eu || !eu) return es ?? '';
  if (!es) return eu;
  return `${eu} / ${es}`;
}

// ── Tarjeta de resultado (Material 3 · bento accent verde) ─────────────
function renderResultado(codigo, entry) {
  const card = document.createElement('div');
  card.className =
    'relative bg-secondary-container/30 border border-secondary-fixed-dim rounded-2xl p-4 flex flex-col gap-2 overflow-hidden';

  // Banda lateral decorativa
  const banda = document.createElement('div');
  banda.className = 'absolute top-0 left-0 w-1 h-full bg-secondary-fixed';
  card.appendChild(banda);

  // Cabecera: aula + icono
  const cab = document.createElement('div');
  cab.className = 'flex items-start justify-between';

  const cabIzq = document.createElement('div');
  cabIzq.className = 'flex flex-col';
  const eyebrow = document.createElement('span');
  eyebrow.className = 'text-[11px] font-semibold uppercase tracking-wider text-on-secondary-container';
  eyebrow.textContent = 'Gela / Aula';
  cabIzq.appendChild(eyebrow);

  const tituloAula = document.createElement('h3');
  tituloAula.className = 'font-serif text-2xl font-semibold text-on-surface mt-0.5';
  const aulaTxt = bilingue(entry.aula_es, entry.aula_eu);
  tituloAula.textContent = aulaTxt || '—';
  cabIzq.appendChild(tituloAula);
  cab.appendChild(cabIzq);

  const icono = document.createElement('span');
  icono.className = 'material-symbols-outlined text-secondary-fixed-dim text-[32px]';
  icono.textContent = 'meeting_room';
  cab.appendChild(icono);

  card.appendChild(cab);

  // Detalles: código, asignatura, día, hora
  const detalles = document.createElement('div');
  detalles.className = 'flex flex-col gap-1 mt-1';

  const fila = (icon, etiqueta, valor) => {
    if (!valor) return null;
    const row = document.createElement('div');
    row.className = 'flex items-start gap-2 text-on-surface-variant';
    const ic = document.createElement('span');
    ic.className = 'material-symbols-outlined text-[18px] mt-0.5 shrink-0';
    ic.textContent = icon;
    row.appendChild(ic);
    const txt = document.createElement('span');
    txt.className = 'text-sm';
    // Construimos con textContent puro · nada de innerHTML
    const span1 = document.createElement('span');
    span1.className = 'opacity-70';
    span1.textContent = etiqueta + ': ';
    const span2 = document.createElement('span');
    span2.className = 'font-medium text-on-surface';
    span2.textContent = valor;
    txt.appendChild(span1);
    txt.appendChild(span2);
    row.appendChild(txt);
    return row;
  };

  const filaCod = fila('badge', 'Kodea / Código', codigo);
  if (filaCod) detalles.appendChild(filaCod);

  const asigTxt = bilingue(entry.asignatura_es, entry.asignatura_eu);
  const filaAsig = fila('book', 'Irakasgaia / Asignatura', asigTxt);
  if (filaAsig) detalles.appendChild(filaAsig);

  const diaTxt = bilingue(entry.dia_es, entry.dia_eu);
  const filaDia = fila('event', 'Eguna / Día', diaTxt);
  if (filaDia) detalles.appendChild(filaDia);

  const hora =
    entry.hora_inicio && entry.hora_fin
      ? `${entry.hora_inicio}–${entry.hora_fin}`
      : '';
  const filaHora = fila('schedule', 'Ordua / Hora', hora);
  if (filaHora) detalles.appendChild(filaHora);

  card.appendChild(detalles);
  return card;
}

// ── Mensaje (error o aviso) en la zona dedicada ─────────────────────────
function mostrarMensaje(texto, tipo = 'error') {
  const seccion = document.getElementById('seccionMensaje');
  const div = document.getElementById('mensaje');
  if (!seccion || !div) return;
  while (div.firstChild) div.removeChild(div.firstChild);
  div.textContent = texto;
  // Cambiamos estilo según tipo
  if (tipo === 'aviso') {
    div.className =
      'bg-surface-container-high text-on-surface-variant border border-outline-variant/60 rounded-xl p-4 text-sm';
  } else {
    div.className =
      'bg-error-container text-on-error-container border border-error/30 rounded-xl p-4 text-sm';
  }
  seccion.classList.remove('hidden');
}

function limpiarMensaje() {
  const seccion = document.getElementById('seccionMensaje');
  if (seccion) seccion.classList.add('hidden');
}

// ── Mostrar lista de resultados ─────────────────────────────────────────
async function mostrarResultados(codigos) {
  const seccionRes = document.getElementById('seccionResultado');
  const resultDiv = document.getElementById('result');
  if (!resultDiv || !seccionRes) return;

  // Limpieza segura: removeChild en bucle (no innerHTML='')
  while (resultDiv.firstChild) resultDiv.removeChild(resultDiv.firstChild);
  limpiarMensaje();

  if (codigos.length === 0) {
    seccionRes.classList.add('hidden');
    mostrarMensaje(
      'Mesedez, sartu irakasgai baten kodea / Por favor, introduce un código de asignatura',
      'aviso',
    );
    return;
  }

  try {
    const data = await cargarDatos();
    const nodos = [];
    const noEncontrados = [];

    for (const codBruto of codigos) {
      const cod = String(codBruto).toUpperCase().trim();
      if (!REGEX_CODIGO.test(cod)) {
        noEncontrados.push(codBruto);
        continue;
      }
      const entry = data[cod];
      if (entry) nodos.push(renderResultado(cod, entry));
      else noEncontrados.push(codBruto);
    }

    if (nodos.length === 0) {
      seccionRes.classList.add('hidden');
      mostrarMensaje(
        'Irakasgaiaren kodea ez da aurkitu / Código de asignatura no encontrado',
      );
      return;
    }

    for (const n of nodos) resultDiv.appendChild(n);
    seccionRes.classList.remove('hidden');
    seccionRes.classList.add('flex');

    if (noEncontrados.length > 0) {
      mostrarMensaje(
        'Aurkitu gabeko kodeak / Códigos no encontrados: ' +
          noEncontrados.join(', '),
        'aviso',
      );
    }

    // Scroll suave al resultado (sólo si venía de búsqueda manual)
    if (window.__usuarioBuscoManual) {
      seccionRes.scrollIntoView({ behavior: 'smooth', block: 'start' });
      window.__usuarioBuscoManual = false;
    }
  } catch (error) {
    console.error(error);
    seccionRes.classList.add('hidden');
    mostrarMensaje(
      'Errorea datuak kontsultatzerakoan / Error al consultar los datos',
    );
  }
}

// ── Búsqueda manual desde el input ──────────────────────────────────────
async function findClassroom() {
  const input = document.getElementById('courseCode');
  if (!input) return;
  const courseCode = (input.value || '').trim();
  window.__usuarioBuscoManual = true;
  await mostrarResultados(courseCode ? [courseCode] : []);
}

// ── Lectura inicial: ?codigos=A,B,C en la URL ───────────────────────────
async function mostrarDesdeUrl() {
  const params = new URLSearchParams(window.location.search);
  const cod = params.get('codigos') ?? params.get('codigo'); // singular legacy
  if (!cod) return;
  const codigos = cod
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (codigos.length === 0) return;
  await mostrarResultados(codigos);
}

// ── Counter (modo admin) ───────────────────────────────────────────────
async function updateCounter() {
  const counterDiv = document.getElementById('counter');
  if (!counterDiv) return;
  if (!isAdmin()) {
    counterDiv.classList.add('hidden');
    return;
  }
  counterDiv.classList.remove('hidden');
  try {
    const response = await fetch(
      'https://api.counterapi.dev/v1/use2025.github.io/visitas/up',
    );
    const data = await response.json();
    counterDiv.textContent = `Visitas: ${data.Count}`;
  } catch (error) {
    console.error('Error al actualizar el contador', error);
    counterDiv.textContent = 'No se pudo actualizar el contador';
  }
}

function isAdmin() {
  return new URLSearchParams(window.location.search).get('admin') === '1';
}

// ── Bottom nav · cambia de pestaña visible ──────────────────────────────
const TABS = {
  buscar: ['seccionBuscar', 'seccionResultado', 'seccionMensaje'],
  info: [], // el botón ya enlaza al PDF arriba; aquí solo marcamos pestaña
  ayuda: ['seccionAyuda'],
};

function activarTab(nombre) {
  // Todas las secciones que controlan los tabs:
  const todas = new Set();
  Object.values(TABS).forEach((arr) => arr.forEach((id) => todas.add(id)));

  // Por defecto ocultamos las controladas; las visibles las marcará la lógica
  for (const id of todas) {
    const el = document.getElementById(id);
    if (!el) continue;
    el.classList.add('hidden');
    el.classList.remove('flex');
  }

  if (nombre === 'buscar') {
    // Búsqueda + resultados (si hay) + mensaje (si hay)
    document.getElementById('seccionBuscar')?.classList.remove('hidden');
    document.getElementById('seccionBuscar')?.classList.add('flex');
    const res = document.getElementById('seccionResultado');
    if (res && res.querySelector('#result')?.children?.length) {
      res.classList.remove('hidden');
      res.classList.add('flex');
    }
    const msg = document.getElementById('seccionMensaje');
    if (msg && msg.querySelector('#mensaje')?.textContent?.trim()) {
      msg.classList.remove('hidden');
    }
  } else if (nombre === 'ayuda') {
    const ay = document.getElementById('seccionAyuda');
    if (ay) {
      ay.classList.remove('hidden');
      ay.classList.add('flex');
    }
  } else if (nombre === 'info') {
    // El PDF se descarga desde el enlace ya visible arriba; hacemos scroll a él.
    const link = document.querySelector('a[href$=".pdf"]');
    if (link) link.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Estilo activo del tab
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    const activo = btn.getAttribute('data-tab') === nombre;
    btn.classList.toggle('text-primary', activo);
    btn.classList.toggle('text-on-surface-variant', !activo);
    const pill = btn.querySelector('.nav-pill');
    if (pill) {
      pill.classList.toggle('bg-secondary-container', activo);
      pill.classList.toggle('text-on-secondary-container', activo);
    }
    const icon = btn.querySelector('.material-symbols-outlined');
    if (icon) icon.classList.toggle('filled', activo);
  });
}

// ── DOM ready ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  updateCounter();
  mostrarDesdeUrl();

  // Form buscar
  const form = document.getElementById('formBuscar');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      findClassroom();
    });
  }

  // Bottom nav
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const t = btn.getAttribute('data-tab');
      if (t) activarTab(t);
    });
  });

  // Estado inicial: pestaña Bilatu activa
  activarTab('buscar');
});
