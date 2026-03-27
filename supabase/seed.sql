truncate table
  price_tiers,
  tickets,
  orders,
  coupon_redemptions,
  performances,
  plays
restart identity cascade;

insert into plays (title, description, image_url, duration_minutes, rating)
values
('Gran Circo de las Estrellas', 'Un espectáculo familiar con maestros de ceremonia, acrobacias aéreas y un cierre luminoso que celebra la magia del escenario en cada acto.', '/imagenes/obra-1.jpg', 110, 'Todo público'),
('Fantasía Bajo la Carpa', 'Una producción poética con personajes soñadores, vestuario colorido y números que mezclan teatro, música y humor elegante.', '/imagenes/obra-2.jpg', 95, 'Todo público'),
('La Ruta del Trapecista', 'Drama escénico con energía circense sobre valentía, equilibrio y el deseo de conquistar la gran función de la noche.', '/imagenes/obra-3.jpg', 105, 'Mayores de 7'),
('Payasos de Medianoche', 'Comedia de ritmo rápido con juegos visuales, sorpresas escénicas y una banda sonora vibrante que sostiene la tensión del espectáculo.', '/imagenes/obra-4.jpg', 100, 'Todo público'),
('Cabaret de Luces y Sombras', 'Una obra con tono más elegante y nocturno que combina misterio, coreografía y una ambientación inspirada en antiguas carpas europeas.', '/imagenes/obra-5.jpg', 120, 'Mayores de 13');

insert into performances (play_id, starts_at, hall, status, capacity_total, capacity_available)
values
(1, now() + interval '2 days' + interval '19 hours', 'Gran Carpa Principal', 'ACTIVE', 220, 220),
(1, now() + interval '5 days' + interval '16 hours', 'Gran Carpa Principal', 'ACTIVE', 220, 220),
(2, now() + interval '3 days' + interval '18 hours', 'Sala Dorada', 'ACTIVE', 180, 180),
(2, now() + interval '6 days' + interval '15 hours', 'Sala Dorada', 'ACTIVE', 180, 180),
(3, now() + interval '4 days' + interval '20 hours', 'Escenario Azul', 'ACTIVE', 160, 160),
(3, now() + interval '8 days' + interval '17 hours', 'Escenario Azul', 'ACTIVE', 160, 160),
(4, now() + interval '2 days' + interval '14 hours', 'Sala Principal', 'ACTIVE', 200, 200),
(4, now() + interval '7 days' + interval '19 hours', 'Sala Principal', 'ACTIVE', 200, 200),
(5, now() + interval '4 days' + interval '18 hours', 'Teatro Mayor', 'ACTIVE', 150, 150),
(5, now() + interval '9 days' + interval '20 hours', 'Teatro Mayor', 'ACTIVE', 150, 150);

insert into price_tiers (performance_id, label, price_cents)
select id, 'General', 1200 from performances
union all
select id, 'VIP', 2200 from performances;
