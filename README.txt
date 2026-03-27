TEATRO CARTELERA - CAMBIOS VISUALES Y DE ESTRUCTURA

1) Qué cambió
- La portada ahora muestra obras, no funciones.
- Cada obra tiene su propia ficha con imagen grande y exactamente 2 funciones de ejemplo en el seed.
- Se retiró el uso visual del cupón en la interfaz.
- El panel admin ahora permite crear, editar y eliminar obras y funciones.
- Las obras aceptan ruta de imagen tipo /imagenes/obra-1.jpg.
- Se reforzaron validaciones de formularios y mensajes de error.

2) Carpeta de imágenes
- Coloca tus imágenes en frontend/public/imagenes
- Nombres sugeridos:
  obra-1.jpg
  obra-2.jpg
  obra-3.jpg
  obra-4.jpg
  obra-5.jpg
  obra-placeholder.jpg
- Tamaño recomendado: 1600 x 900 px, formato JPG o WEBP.

3) Obras sembradas en seed.sql
1. Gran Circo de las Estrellas
2. Fantasía Bajo la Carpa
3. La Ruta del Trapecista
4. Payasos de Medianoche
5. Cabaret de Luces y Sombras

4) Qué archivos debes volver a aplicar en Supabase
- Ejecuta nuevamente supabase/seed.sql para dejar 5 obras y 2 funciones por cada una.
- Si solo cambias frontend, no hace falta volver a correr schema.sql.

5) Notas
- La app sigue comprando tickets con la función public.buy_tickets ya existente.
- Las imágenes se sirven de forma estática desde Vite/Netlify usando la carpeta public/imagenes.
