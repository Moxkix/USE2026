 const QR_LOG_URL = "https://qr-log-tribunal.moxkix.workers.dev";

  (function enviarBeacon() {
    if (!QR_LOG_URL) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const codigosStr = params.get("codigos") || params.get("codes") || "";
      const codigos = codigosStr.split(",").map((c) => c.trim()).filter(Boolean);
      if (codigos.length === 0) return;
      fetch(QR_LOG_URL.replace(/\/$/, "") + "/scan", {
    if (!QR_LOG_URL) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const codigosStr = params.get("codigos") || params.get("codes") || "";
      const codigos = codigosStr.split(",").map((c) => c.trim()).filter(Boolean);
      fetch(QR_LOG_URL.replace(/\/$/, "") + "/scan", {
      if (codigos.length === 0) return;
      fetch(QR_LOG_URL.replace(/\/$/, "") + "/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigos }),
        keepalive: true,
      }).catch(() => {});
    } catch (e) {}
  })();

// Versión actualizada para 2026:
//   - Muestra día y hora junto con el aula
//   - Soporta ?codigos=A,B,C en la URL para mostrar varios resultados de una vez (QR personalizado)
//   - Mantiene retrocompatibilidad con el formato JSON original

let CACHE_DATA = null;

async function cargarDatos() {
  if (CACHE_DATA) return CACHE_DATA;
  const response = await fetch('asignaturas_aulas.json');
  CACHE_DATA = await response.json();
  return CACHE_DATA;
}

function bilingue(es, eu) {
  if (!es && !eu) return '';
  if (es === eu || !eu) return es ?? '';
  return `${es} / ${eu}`;
}

function renderResultado(codigo, entry) {
  const asig = bilingue(entry.asignatura_es, entry.asignatura_eu);
  const aula = bilingue(entry.aula_es, entry.aula_eu);
  const dia = bilingue(entry.dia_es, entry.dia_eu);
  const hora = entry.hora_inicio && entry.hora_fin
    ? `${entry.hora_inicio}–${entry.hora_fin}`
    : '';
  return `
    <div class="card">
      <div class="codigo">Código / Kodea: <strong>${codigo}</strong></div>
      <div class="linea"><span class="et">Asignatura / Irakasgaia:</span> <strong>${asig}</strong></div>
      <div class="linea"><span class="et">Aula / Gela:</span> <strong>${aula}</strong></div>
      ${dia ? `<div class="linea"><span class="et">Día / Eguna:</span> ${dia}</div>` : ''}
      ${hora ? `<div class="linea"><span class="et">Hora / Ordua:</span> ${hora}</div>` : ''}
    </div>
  `;
}

async function mostrarResultados(codigos) {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = '';
  if (codigos.length === 0) {
    resultDiv.textContent = 'Mesedez, sartu irakasgai baten kodea / Por favor, introduce un código de asignatura';
    return;
  }
  try {
    const data = await cargarDatos();
    const partes = [];
    const noEncontrados = [];
    for (const cod of codigos) {
      const entry = data[cod.toUpperCase().trim()];
      if (entry) partes.push(renderResultado(cod.toUpperCase().trim(), entry));
      else noEncontrados.push(cod);
    }
    if (partes.length === 0) {
      resultDiv.textContent = 'Irakasgaiaren kodea ez da aurkitu / Código de asignatura no encontrado';
      return;
    }
    resultDiv.innerHTML = partes.join('');
    if (noEncontrados.length > 0) {
      const aviso = document.createElement('div');
      aviso.className = 'aviso';
      aviso.textContent = `Códigos no encontrados / Aurkitu gabeko kodeak: ${noEncontrados.join(', ')}`;
      resultDiv.appendChild(aviso);
    }
  } catch (error) {
    console.error(error);
    resultDiv.textContent = 'Errorea datuak kontsultatzerakoan / Error al consultar los datos';
  }
}

// Búsqueda manual desde el input
async function findClassroom() {
  const courseCode = document.getElementById('courseCode').value;
  await mostrarResultados([courseCode]);
}

// Lectura inicial: si hay ?codigos=A,B,C en la URL, busca todos
async function mostrarDesdeUrl() {
  const params = new URLSearchParams(window.location.search);
  const cod = params.get('codigos') ?? params.get('codigo'); // singular legacy
  if (!cod) return;
  const codigos = cod.split(',').map((s) => s.trim()).filter(Boolean);
  if (codigos.length === 0) return;
  await mostrarResultados(codigos);
}

// Counter (modo admin) — mantenido del año pasado
async function updateCounter() {
  const counterDiv = document.getElementById('counter');
  if (!counterDiv) return;
  if (!isAdmin()) {
    counterDiv.style.display = 'none';
    return;
  }
  counterDiv.style.display = 'block';
  try {
    const response = await fetch('https://api.counterapi.dev/v1/use2025.github.io/visitas/up');
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

document.addEventListener('DOMContentLoaded', () => {
  updateCounter();
  mostrarDesdeUrl();
  // Permite Enter en el input
  const input = document.getElementById('courseCode');
  if (input) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') findClassroom();
    });
  }
});
