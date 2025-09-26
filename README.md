# KSupervision

Plataforma Next.js 15 orientada a la supervisión operativa de tiendas. Incluye autenticación, panel administrativo y módulos especializados para gestionar usuarios y puntos de venta.

## Requisitos previos

- Node.js 18 o superior
- MongoDB Atlas o instancia compatible
- Clave de Google Places API con acceso a los endpoints de búsqueda y detalles

## Variables de entorno

Crea un archivo `.env.local` en la raíz del proyecto con los valores adecuados:

```bash
MONGODB_URI="mongodb+srv://<usuario>:<password>@<cluster>/<db>?retryWrites=true&w=majority"
MONGODB_DB="KelloggsBD_react"
MONGODB_COLLECTION_USERS="Usuarios"
MONGODB_COLLECTION_STORES="Tiendas"
GOOGLE_PLACES_API_KEY="<tu-clave-de-google-places>"
R2_BUCKET_NAME="kelloggsreact"
R2_ENDPOINT="https://4789cef00f8be107bc9d44233859ac7e.r2.cloudflarestorage.com"
R2_ACCESS_KEY_ID="<tu-access-key>"
R2_SECRET_ACCESS_KEY="<tu-secret-key>"
# Opcional si expones la imagen mediante un dominio/CDN propio
R2_PUBLIC_BASE_URL="https://4789cef00f8be107bc9d44233859ac7e.r2.cloudflarestorage.com/kelloggsreact"
```

> La Google Places API se consulta desde rutas del servidor para proteger la clave. Asegúrate de habilitar `Places API` en Google Cloud y restringir la clave a los endpoints necesarios.
> Las credenciales de Cloudflare R2 son sensibles: guarda estos valores únicamente en variables de entorno (locales y en la plataforma de despliegue) y evita exponerlos en el repositorio.

## Instalación

```bash
npm install
```

## Scripts disponibles

- `npm run dev` – levanta el servidor de desarrollo (por defecto en `http://localhost:3000`).
- `npm run build` – compila la aplicación para producción.
- `npm run start` – ejecuta la build ya compilada.
- `npm run lint` – ejecuta la configuración de ESLint.

## Panel administrativo

- **Gestión de usuarios**: alta, edición y baja de cuentas con roles (`admin`, `supervisor`, `usuario`).
- **Gestión de tiendas**: registro y edición de tiendas con formularios modales, búsqueda mediante Google Places, geolocalización y asignación múltiple de supervisores.

### Campos de una tienda

- Nombre y número de tienda.
- Formato (`Walmart`, `Mas x Menos`, `Pali`, `Maxi Pali`).
- Provincia y zona/cantón.
- Supervisores (usuarios con rol `admin` o `supervisor`).
- Coordenadas GPS y dirección de referencia.
- Integración con Google Places para autocompletar información y previsualizar la ubicación en un mapa.

## Estilo y accesibilidad

El diseño aplica un tema oscuro con componentes translúcidos. Los formularios modales reutilizan estilos globales (`admin-card`, `admin-modal`) para mantener contraste y coherencia visual. La previsualización de mapas usa Leaflet con tiles de OpenStreetMap, únicamente como referencia visual.

## Próximos pasos sugeridos

- Añadir validaciones adicionales para catálogos de cantones por provincia.
- Gestionar auditoría de cambios en tiendas (bitácora por usuario).
- Incorporar sincronización con sistemas externos mediante webhooks o colas de mensajes.
