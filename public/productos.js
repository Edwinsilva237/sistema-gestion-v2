let productosGlobal = [];
let paginaActual = 1;
const productosPorPagina = 10;


async function cargarProductos() {
  try {
    const response = await fetch("https://appgh-2z0e.onrender.com/productos");
    const productos = await response.json();

    productos.sort((a, b) => a.nombre.localeCompare(b.nombre));

    productosGlobal = productos;
    paginaActual = 1;
    renderizarTablaPaginada(productos);
  } catch (err) {
    console.error("❌ Error al cargar productos:", err);
    alert("Error al cargar los productos.");
  }
}

function editarProducto(id, nombre, precio, categoria, stock, clave) {
  document.getElementById("editarId").value = id;
  document.getElementById("editarNombre").value = nombre;
  document.getElementById("editarPrecio").value = precio;
  document.getElementById("editarCategoria").value = categoria;
  document.getElementById("editarStock").value = stock;
  document.getElementById("editarClave").value = clave;


  // Si agregás el campo clave en el modal, podés asignarlo acá también
  // document.getElementById("editarClave").value = clave;

  const modal = new bootstrap.Modal(document.getElementById("modalEditarProducto"));
  modal.show();
}

function renderizarTablaPaginada(productos) {
  const tbody = document.querySelector("#tablaProductos tbody");
  tbody.innerHTML = "";

  const totalPaginas = Math.ceil(productos.length / productosPorPagina);
  const inicio = (paginaActual - 1) * productosPorPagina;
  const fin = inicio + productosPorPagina;
  const productosPagina = productos.slice(inicio, fin);

  if (productosPagina.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">No hay productos registrados</td></tr>`;
    return;
  }

  productosPagina.forEach(prod => {
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${prod.id}</td>
      <td>${prod.clave || '-'}</td>
      <td>${prod.nombre}</td>
      <td>$${parseFloat(prod.precio).toFixed(2)}</td>
      <td>${prod.categoria || "-"}</td>
      <td>${prod.stock ?? 0}</td>
      <td>
        <div class="dropdown">
          <button class="btn btn-sm btn-outline-light dropdown-toggle" type="button" data-bs-toggle="dropdown">
            Opciones
          </button>
          <ul class="dropdown-menu dropdown-menu-dark">
            <li>
              <a class="dropdown-item" href="#" onclick="editarProducto(${prod.id}, '${prod.nombre}', '${prod.precio}', '${prod.categoria}', '${prod.stock}', '${prod.clave}')">
                <i class="fas fa-edit me-2 text-warning"></i>Editar
              </a>
            </li>
            <li>
              <a class="dropdown-item text-danger" href="#" onclick="eliminarProducto(${prod.id})">
                <i class="fas fa-trash-alt me-2\"></i>Eliminar
              </a>
            </li>
          </ul>
        </div>
      </td>
    `;
    tbody.appendChild(fila);
  });

  renderizarPaginacion(productos, totalPaginas);
}
function renderizarPaginacion(productos, totalPaginas) {
  const paginador = document.getElementById("paginador");
  paginador.innerHTML = "";

  for (let i = 1; i <= totalPaginas; i++) {
    const btn = document.createElement("button");
    btn.className = `btn btn-sm mx-1 ${i === paginaActual ? 'btn-primary' : 'btn-outline-primary'}`;
    btn.textContent = i;
    btn.onclick = () => {
      paginaActual = i;
      renderizarTablaPaginada(productos);
    };
    paginador.appendChild(btn);
  }
}


async function guardarCambiosProducto() {
  const id = document.getElementById("editarId").value;
  const nombre = document.getElementById("editarNombre").value.trim();
  const precio = parseFloat(document.getElementById("editarPrecio").value);
  const categoria = document.getElementById("editarCategoria").value.trim();
  const stock = parseInt(document.getElementById("editarStock").value);
  const clave = document.getElementById("editarClave").value.trim();


  if (!nombre || isNaN(precio)) {
    alert("⚠️ Nombre y precio son obligatorios");
    return;
  }

  const response = await fetch(`https://appgh-2z0e.onrender.com/productos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, clave, precio, categoria, stock })

  });

  const data = await response.json();

  if (data.error) {
    alert("❌ Error: " + data.error);
  } else {
    alert("✅ Producto actualizado");
    const modal = bootstrap.Modal.getInstance(document.getElementById("modalEditarProducto"));
    modal.hide();
    await cargarProductos();
  }
}

function filtrarProductos() {
  const nombre = document.getElementById("filtroNombre").value.toLowerCase();
  const categoria = document.getElementById("filtroCategoria").value.toLowerCase();

  const filtrados = productosGlobal.filter(p =>
    p.nombre.toLowerCase().includes(nombre) &&
    p.categoria.toLowerCase().includes(categoria)
  );

  paginaActual = 1;
  renderizarTablaPaginada(filtrados);
}


async function guardarProducto() {
  const nombre = document.getElementById("productoNombre").value.trim();
  const precio = parseFloat(document.getElementById("productoPrecio").value);
  const categoria = document.getElementById("productoCategoria").value.trim();
  const stock = parseInt(document.getElementById("productoStock").value);

  if (!nombre || isNaN(precio)) {
    alert("⚠️ El nombre y precio son obligatorios.");
    return;
  }

  const response = await fetch("https://appgh-2z0e.onrender.com/productos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ nombre, precio, categoria, stock })
  });

  const data = await response.json();

  if (data.error) {
    alert("❌ Error: " + data.error);
  } else {
    alert("✅ Producto guardado correctamente");
    document.getElementById("productoForm").reset();
    await cargarProductos();
  }
}

async function eliminarProducto(id) {
  if (!confirm("¿Eliminar este producto?")) return;

  const response = await fetch(`https://appgh-2z0e.onrender.com/productos/${id}`, {
    method: "DELETE"
  });

  const data = await response.json();

  if (data.error) {
    alert("❌ Error al eliminar: " + data.error);
  } else {
    alert("🗑️ Producto eliminado");
    await cargarProductos();
  }
}
function importarProductosDesdeExcel() {
  const archivo = document.getElementById("archivoExcel").files[0];
  if (!archivo) return alert("⚠️ Selecciona un archivo Excel");

  const lector = new FileReader();
  lector.onload = function(e) {
    const data = new Uint8Array(e.target.result);
    const workbook = XLSX.read(data, { type: "array" });
    const hoja = workbook.Sheets[workbook.SheetNames[0]];
    const filas = XLSX.utils.sheet_to_json(hoja);

    const productos = filas.map(p => ({
      nombre: (p["Nombre"] || "").substring(0, 100),
      clave: (p["Clave del producto"] || "").substring(0, 50),
      categoria: (p["Categoría"] || "").substring(0, 50),
      precio: parseFloat(p["Precio total"]) || 0,
      stock: 0
    }));
    

    console.log("📦 Productos importados:", productos);

    fetch("https://appgh-2z0e.onrender.com/importar-productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productos)
    })
    .then(res => res.json())
    .then(data => {
      alert("✅ Productos importados correctamente");
    })
    .catch(err => {
      console.error("❌ Error al importar productos:", err);
      alert("Error al importar productos");
    });
  };

  lector.readAsArrayBuffer(archivo);
}


document.addEventListener("DOMContentLoaded", cargarProductos);
document.getElementById("filtroNombre").addEventListener("input", filtrarProductos);
document.getElementById("filtroCategoria").addEventListener("input", filtrarProductos);
