[README.md](https://github.com/user-attachments/files/27208464/README.md)
# Actualización USE2025 para 2026

Este directorio contiene los cambios mínimos que necesita el repo
[Moxkix/USE2025](https://github.com/Moxkix/USE2025) para integrarse con la nueva
app de gestión Selectividad:

- `asignaturas_aulas.json` con campos extra **día y hora**
- Lectura de `?codigos=A,B,C` en la URL (para los QR personalizados)
- UI mejorada para mostrar varios resultados de una vez

## Pasos

### 1. Cambios en el repo (una sola vez)

Reemplaza estos dos ficheros del repo USE2025 con los de esta carpeta:

| Fichero del repo | Reemplazar por |
|------------------|----------------|
| `script.js` | `use2025-update/script.js` |
| `styles.css` | añadir al final el contenido de `use2025-update/styles-extra.css` |

Sube los cambios a `main`. La web en GitHub Pages se actualiza sola en 1-2 minutos.

### 2. Cada convocatoria: subir el JSON nuevo

Después de generar la asignación en la app:

1. Pulsa el botón **"JSON consulta web alumnos"** → descarga `asignaturas_aulas.json`.
2. Sube el fichero al repo USE2025.

Tienes 3 maneras de hacer el upload:

#### Opción rápida (drag & drop)

1. Abre <https://github.com/Moxkix/USE2025>
2. Click en `asignaturas_aulas.json` → botón "Edit" → arrastra el fichero descargado
3. Commit con un mensaje tipo `Update asignaciones 2026 convocatoria ordinaria`

#### Opción CLI (recomendada)

Con `gh` autenticado y `git` configurado, ejecuta el script PowerShell:

```powershell
.\subir-a-repo.ps1 -JsonPath "$HOME\Downloads\asignaturas_aulas.json"
```

(O dale un mensaje personalizado: `-Mensaje "Convocatoria extraordinaria 2026"`)

#### Opción manual

```bash
gh repo clone Moxkix/USE2025
cd USE2025
cp ~/Downloads/asignaturas_aulas.json .
git add asignaturas_aulas.json
git commit -m "Update asignaciones $(date +%Y-%m-%d)"
git push
```

### 3. Verificar

Abre <https://moxkix.github.io/USE2025/?codigos=ABTA,WZQT,PTEA> sustituyendo los
códigos por algunos reales del año actual. Deberías ver tres tarjetas, una por
materia, con día, hora y aula.

## Compatibilidad

- El JSON nuevo es retrocompatible: si la web del año pasado se queda intacta,
  los campos `dia_*` y `hora_*` simplemente se ignoran. Pero el `script.js` viejo
  no muestra esos campos aunque estén en el JSON.
- El `script.js` nuevo soporta tanto el formato antiguo (sin día/hora) como el
  nuevo, así que puedes desplegarlo sin romper nada.

## QR personalizado por alumno

Desde la app, el botón **"Hojas de códigos con QR"** genera un PDF con una hoja
por alumno. Cada hoja incluye:

- Datos del alumno (apellidos, nombre, ID, tipo)
- Tabla con los 4-7 códigos de sus materias + día/hora
- Un QR que apunta a `https://moxkix.github.io/USE2025/?codigos=ABTA,WZQT,PTEA,…`

Cuando el alumno escanea el QR, la web carga su lista completa sin que tenga que
teclear nada. Las hojas se imprimen y se entregan en la primera prueba (o se
recogen en el tribunal si el alumno no se presenta a Lengua Vasca).
