/* =============================================================================
   i18n.js — Traducción del sitio (ES / EN / NL)
   Hotel La Gruta · Arequipa

   Arquitectura
   ------------
   Un solo diccionario plano por idioma (I18N.STRINGS), sin librerías ni
   llamadas a APIs de traducción: todo el copy en EN/NL está escrito a mano
   acá mismo, a partir del español como única fuente de verdad. El español
   (STRINGS.es) es también el fallback si a alguna clave le faltara alguna
   traducción.

   El HTML no tiene texto traducible embebido en más de un idioma: cada nodo
   traducible lleva uno de estos atributos, y este script lo rellena:
     - data-i18n="clave"       → el textContent del elemento
     - data-i18n-html="clave"  → el innerHTML (solo para los pocos casos con
                                  <em>/<br> dentro, ej. "Todo cerca. <em>Nada
                                  de ruido.</em>" — el HTML vive en el propio
                                  string de traducción, ver STRINGS)
     - data-i18n-attr="attr:clave;attr2:clave2" → uno o más atributos
                                  (aria-label, placeholder, etc.)

   Los tres nombres de idioma del selector del menú (ESPAÑOL/ENGLISH/
   NEDERLANDS) NO pasan por este diccionario a propósito: cada idioma
   escribe su propio nombre siempre igual, sin importar el idioma activo
   (mismo patrón que cualquier selector de idioma real).

   Persistencia: localStorage bajo 'lg-lang'. Si no hay nada guardado,
   arranca en 'es' (idioma nativo del sitio) — no se intenta adivinar desde
   navigator.language, para no sorprender con un idioma no elegido a propósito.

   Contenido dinámico (modal de habitación): el nombre/descripción corta del
   modal se leen del DOM en el momento de abrir (de nodos que este script ya
   tradujo), así que salen ya en el idioma activo sin lógica extra. El texto
   LARGO (antes `data-detail`, ahora `data-detail-key`) no vive en el DOM
   como texto visible, así que app.js lo resuelve con I18N.t(key) al abrir el
   modal — ver ensureMenuMap/openModal en app.js.
   ============================================================================= */
(function () {
  'use strict';

  var STORAGE_KEY = 'lg-lang';
  var LANGS = ['es', 'en', 'nl'];
  var DEFAULT_LANG = 'es';

  var STRINGS = {
    es: {
      'nav.book': '▸ Reservar',
      'menu.social.label': 'Síguenos',
      'menu.nav.home': 'Inicio',
      'menu.nav.rooms': 'Habitaciones',
      'menu.nav.reservas': 'Reservas',
      'menu.nav.experiencias': 'Experiencias',

      'hero.home.eyebrow': 'HOTEL BOUTIQUE',
      'hero.home.title': 'La calma también puede ser un destino.',
      'hero.rooms.eyebrow': 'Alojamiento',
      'hero.rooms.title': 'Habitaciones y suites para descansar a tu ritmo.',
      'hero.reservas.eyebrow': 'Reservas',
      'hero.reservas.title': 'Tu próxima pausa empieza aquí.',
      'hero.experiencias.eyebrow': 'Experiencias',
      'hero.experiencias.title1': 'Vive Arequipa',
      'hero.experiencias.title2': 'desde La Gruta',

      'avail.checkin': 'Check In',
      'avail.checkout': 'Check Out',
      'avail.guests': 'Huéspedes',
      'avail.guest1': '1 huésped',
      'avail.guest2': '2 huéspedes',
      'avail.guest3': '3 huéspedes',
      'avail.guest4': '4+ huéspedes',
      'avail.consult': 'Consultar',

      'welcome.script': 'Bienvenido a',
      'welcome.desc': 'En La Gruta, cada espacio invita a bajar el ritmo. Habitaciones amplias, jardines llenos de vida y una atmósfera tranquila para descansar, disfrutar y vivir Arequipa a tu manera.',

      'homemap.eyebrow': 'Por qué La Gruta',
      'homemap.title': 'Todo cerca. <em>Nada de ruido.</em>',
      'homemap.desc': 'A siete minutos caminando de la Plaza de Armas, el ruido se queda atrás. Aquí conviven la Ciudad Blanca y la calma.',
      'homemap.addressLabel': 'Dirección',
      'homemap.checkinLabel': 'Check-in',
      'homemap.checkoutLabel': 'Check-out',
      'homemap.directions': 'Cómo llegar ›',

      'reviews.eyebrow': 'Opiniones de huéspedes',
      'reviews.title': 'Por qué a los huéspedes les encanta La Gruta',
      'reviews.booking.tag': 'Fantástico',
      'reviews.booking.count': '15 comentarios',
      'reviews.booking.more': 'Ver todas en Booking.com',
      'reviews.booking.arrow': 'Ver más opiniones de Booking.com',
      'reviews.tripadvisor.count': '118 opiniones',
      'reviews.tripadvisor.more': 'Ver todas en Tripadvisor',
      'reviews.tripadvisor.arrow': 'Ver más opiniones de TripAdvisor',
      'reviews.b1.country': 'Lituania',
      'reviews.b1.text': 'Hermoso y tranquilo lugar en Arequipa con una recepcionista absolutamente excepcional. ¡¡Muchas gracias por toda su ayuda!!',
      'reviews.b2.country': 'Chile',
      'reviews.b2.text': 'Lugar tranquilo, amabilidad del personal, el desayuno variado, camas cómodas.',
      'reviews.b3.country': 'Estados Unidos',
      'reviews.b3.text': 'Un hotel increíble en todos los sentidos. El personal fue increíblemente amable y atento, especialmente Alexandria y Emily.',
      'reviews.b4.country': 'Alemania',
      'reviews.b4.text': 'Lindo y pequeño hotel con un lindo jardín en una buena ubicación cerca del centro de Arequipa. Personal amable, buen desayuno, muy limpio.',
      'reviews.b5.country': 'Perú',
      'reviews.b5.text': 'Muy tranquilo y se sentía paz en el vecindario, linda la habitación y el personal super amable.',
      'reviews.t1.text': 'Gracias a Emily y a Juan por su preocupación por mí. Tengo EPOC y me ayudaron a disfrutar Arequipa a esa gran altitud.',
      'reviews.t2.text': 'El hotel es muy cómodo, limpio y el personal es muy atento.',
      'reviews.t3.text': 'Excelente trato, un hotel desde luego para tener en cuenta, muy cómodo y jardines muy bonitos. Gracias a Emily y Juan.',
      'reviews.t4.text': 'Limpio, personal amable, hermosas habitaciones, hermoso jardín, muy buena ubicación, tranquilo y cerca del centro de la ciudad.',
      'reviews.t5.text': 'Vinimos aquí al final de un viaje en motocicleta de tres semanas por Perú. Lars y el personal también son motociclistas.',

      'rooms.count': '6 tipos de habitación',
      'rooms.viewAll': 'Ver todas',
      'rooms.viewMore': 'Ver más',
      'rooms.book': 'Reservar',
      'rooms.suite.name': 'Suite',
      'rooms.suite.descShort': 'Nuestra categoría más amplia, con acceso directo al jardín, chimenea y sala de estar privada.',
      'rooms.suite.detail': 'Nuestra categoría más amplia: acceso directo al jardín, chimenea propia y una sala de estar separada del dormitorio, pensada para quienes se quedan varios días y quieren un espacio para trabajar o simplemente estirarse sin salir de la habitación.',
      'rooms.matrimonial.name': 'Matrimonial',
      'rooms.matrimonial.descHomeShort': 'Cama king y vista al jardín para disfrutar una estadía tranquila en pareja.',
      'rooms.matrimonial.descShort': 'Cama king y vista al jardín para una estadía tranquila en pareja.',
      'rooms.matrimonial.detail': 'Cama king y vista al jardín en un ambiente pensado para parejas: la opción más elegida por quienes vienen a Arequipa a desconectar sin renunciar a la comodidad.',
      'rooms.semisuite.name': 'Semi Suite',
      'rooms.semisuite.descShort': 'Más espacio para descansar, con chimenea y área de estar independiente.',
      'rooms.semisuite.detail': 'Un paso intermedio entre la habitación clásica y la Suite: mantiene la chimenea y un área de estar independiente, con algo menos de superficie pero la misma calma del jardín como vista.',
      'rooms.triple.name': 'Triple',
      'rooms.triple.descShort': 'Tres camas y espacio para descansar cómodamente en familia o con amigos.',
      'rooms.triple.detail': 'Tres camas en un mismo ambiente, ideal para viajar en grupo o en familia sin perder comodidad: suficiente espacio para moverse con soltura y descansar todos por igual.',
      'rooms.doble.name': 'Doble',
      'rooms.doble.descShort': 'Dos camas y un ambiente tranquilo para compartir la estadía con comodidad.',
      'rooms.doble.detail': 'Dos camas separadas en un ambiente tranquilo, pensada para compartir habitación sin compartir cama: la opción práctica para amigos o compañeros de viaje.',
      'rooms.individual.name': 'Individual',
      'rooms.individual.descShort': 'Una habitación práctica y acogedora para descansar con comodidad al viajar solo.',
      'rooms.individual.detail': 'Compacta y bien pensada para viajar solo: todo lo esencial a mano, sin espacio de más, para quienes solo necesitan un lugar cómodo donde volver después de recorrer Arequipa.',

      'jardin.title': 'Un jardín para descansar',
      'jardin.desc': 'Selva Alegre guarda un secreto: un jardín de árboles añosos donde solo se escuchan los pájaros. Toma el sol sobre el pasto, lee a la sombra o comparte un café al atardecer. El jardín no es un adorno del hotel: es el corazón de todo.',

      'gastro.title': 'Tu desayuno ideal te espera',
      'gastro.desc': 'Empieza el día frente al jardín con pan artesanal, fruta de estación y café recién pasado. Con reserva previa, también puedes disfrutar platos arequipeños preparados en nuestra cocina.',
      'gastro.note': 'Servicio de masajes disponible en el hotel con cita previa — coordínalo en recepción.',

      'faq.eyebrow': 'Ayuda',
      'faq.title': 'Preguntas frecuentes',
      'faq.q1': '¿A qué hora es el check-in y el check-out?',
      'faq.a1': 'Check-in desde las 14:00 y check-out hasta las 12:00. Si llegas temprano o sales tarde, escríbenos: buscamos la forma de recibirte.',
      'faq.q2': '¿Cómo reservo?',
      'faq.a2': 'Por WhatsApp (+51 974 330 699), por el formulario de esta web o escribiéndonos a lagruta@lagrutahotel.com. Confirmamos en menos de 24 horas.',
      'faq.q3': '¿Tienen estacionamiento?',
      'faq.a3': 'Sí, estacionamiento privado dentro del hotel, sin costo para nuestros huéspedes.',
      'faq.q4': '¿Dónde están exactamente?',
      'faq.a4': 'Pasaje La Gruta 304, Urb. Selva Alegre, a 7 minutos caminando de la Plaza de Armas. Coordinamos traslados desde el aeropuerto y el terminal terrestre.',
      'faq.q5': '¿Se pueden hacer tours desde el hotel?',
      'faq.a5': 'Sí. En recepción coordinamos city tours, Cañón del Colca, rafting y más, con operadores locales de confianza.',
      'faq.q6': '¿Aceptan mascotas?',
      'faq.a6': 'Escríbenos por WhatsApp y lo coordinamos según disponibilidad.',

      'band.title': 'Arequipa para descubrir.<br><em>La Gruta para disfrutar.</em>',
      'band.cta': 'Reserva tu estadía',

      'footer.tagline': 'Hotel boutique · Arequipa, Perú',
      'footer.desc': 'Calma a pasos del centro histórico de Arequipa.',
      'footer.navTitle': 'Navegación',
      'footer.contactTitle': 'Contacto',
      'footer.near': 'A solo 7 minutos caminando de la Plaza de Armas.',
      'footer.credit': 'Desarrollado por Blanca Labz',

      'experience.eyebrow': 'La experiencia',
      'experience.title': 'La experiencia La Gruta',
      'experience.jardines.title': 'Jardines',
      'experience.jardines.desc': 'Un jardín centenario donde el silencio se respira, no se escucha.',
      'experience.desayuno.title': 'Desayuno',
      'experience.desayuno.desc': 'Pan artesanal y fruta de estación, servidos frente al jardín cada mañana.',
      'experience.calma.title': 'Calma',
      'experience.calma.desc': 'El tiempo se mide distinto cuando no hay prisa por llegar a ningún lado.',

      'rv.title': 'Encuentra la habitación ideal para tu estadía.',
      'rv.desc': 'Envíanos tus fechas y preferencias. Te ayudaremos a elegir la habitación que mejor se adapte a tu estadía y confirmaremos la disponibilidad directamente contigo.',
      'rv.contact.whatsapp': 'WhatsApp',
      'rv.contact.phone': 'Teléfono',
      'rv.contact.email': 'Email',
      'rv.contact.checkinout': 'Check-in / out',
      'rv.form.requiredNote': 'Campos obligatorios',
      'rv.form.nombre': 'Nombre completo',
      'rv.form.nombrePh': 'Tu nombre',
      'rv.form.telefono': 'Teléfono',
      'rv.form.correo': 'Correo electrónico',
      'rv.form.correoPh': 'correo@ejemplo.com',
      'rv.form.habitacion': 'Habitación',
      'rv.form.seleccionar': 'Seleccionar',
      'rv.form.huespedes': 'Huéspedes',
      'rv.form.huespedesPh': '1',
      'rv.form.llegada': 'Llegada',
      'rv.form.salida': 'Salida',
      'rv.form.mensaje': 'Mensaje adicional',
      'rv.form.mensajePh': '¿Alguna preferencia especial?',
      'rv.form.submit': 'Consultar disponibilidad por WhatsApp',
      'rv.form.mailtoLink': 'Prefiero consultar por correo',

      'exp.eyebrow': 'Tours & aventuras',
      'exp.intro': 'Desde recepción coordinamos tours, traslados y experiencias con operadores locales de confianza. Te ayudamos a elegir cada plan y organizamos el recojo para que disfrutes Arequipa sin complicaciones.',
      'exp.badge': 'El más solicitado',
      'exp.consultWa': 'Consultar por WhatsApp',
      'exp.note': 'Tarifas referenciales por persona. Antes de reservar, confirmamos contigo disponibilidad, horarios, punto de recojo y servicios incluidos.',
      'tour.colca.name': 'Cañón del Colca',
      'tour.colca.desc': 'El vuelo del cóndor en la Cruz del Cóndor, aguas termales en Chivay y pueblos coloniales. Full day o 2 días/1 noche.',
      'tour.colca.meta': 'desde S/80',
      'tour.ciudadcampina.name': 'Ciudad & Campiña',
      'tour.ciudadcampina.desc': 'Yanahuara, el mirador de Carmen Alto, la Mansión del Fundador y el Molino de Sabandía en un solo recorrido por la campiña arequipeña.',
      'tour.ciudadcampina.meta': '4–5 h · salidas diarias · desde S/45',
      'tour.santacatalina.name': 'Monasterio de Santa Catalina',
      'tour.santacatalina.desc': 'Una ciudad dentro de la ciudad: claustros de colores, patios de sillar y cuatro siglos de historia a pocos pasos de la Plaza de Armas.',
      'tour.santacatalina.meta': '3 h · privado · desde S/150',
      'tour.sillar.name': 'Canteras de Sillar',
      'tour.sillar.desc': 'Desciende a la quebrada de Añashuayco, donde se extrajo la piedra blanca que construyó toda la Ciudad Blanca.',
      'tour.sillar.meta': '~3 h · S/45',
      'tour.rafting.name': 'Rafting en el Río Chili',
      'tour.rafting.desc': 'Rápidos de nivel II–III a 20 minutos del centro. Sin experiencia previa: guía bilingüe y equipo completo incluido.',
      'tour.rafting.meta': '3 h · turnos 8:00, 11:00 y 14:00 · S/80',
      'tour.pillones.name': 'Catarata de Pillones',
      'tour.pillones.desc': 'Full day entre el Bosque de Piedras de Imata, vicuñas en la Reserva de Salinas y miradores de los tres volcanes.',
      'tour.pillones.meta': 'Full day · S/80',
      'tour.volcanes.name': 'Volcán Misti & Chachani',
      'tour.volcanes.desc': 'Ascenso de 2 días/1 noche con guía oficial de montaña UIAGM. Para quienes buscan la cima.',
      'tour.volcanes.meta': '2D/1N · desde S/450',

      'wa.ariaLabel': 'Escribir por WhatsApp',

      'modal.close': 'Cerrar',
      'modal.prevPhoto': 'Foto anterior',
      'modal.nextPhoto': 'Foto siguiente',
      'modal.amenity.wifi': 'Wifi gratis',
      'modal.amenity.water': 'Agua caliente 24 h',
      'modal.amenity.breakfast': 'Desayuno incluido',
      'modal.amenity.parking': 'Estacionamiento gratuito',
      'modal.amenity.massage': 'Masaje con cita previa',
      'modal.book': 'Reservar esta habitación'
    },

    en: {
      'nav.book': '▸ Book',
      'menu.social.label': 'Follow us',
      'menu.nav.home': 'Home',
      'menu.nav.rooms': 'Rooms',
      'menu.nav.reservas': 'Booking',
      'menu.nav.experiencias': 'Experiences',

      'hero.home.eyebrow': 'BOUTIQUE HOTEL',
      'hero.home.title': 'Calm can be a destination too.',
      'hero.rooms.eyebrow': 'Stay',
      'hero.rooms.title': 'Rooms and suites to rest at your own pace.',
      'hero.reservas.eyebrow': 'Booking',
      'hero.reservas.title': 'Your next pause starts here.',
      'hero.experiencias.eyebrow': 'Experiences',
      'hero.experiencias.title1': 'Experience Arequipa',
      'hero.experiencias.title2': 'from La Gruta',

      'avail.checkin': 'Check In',
      'avail.checkout': 'Check Out',
      'avail.guests': 'Guests',
      'avail.guest1': '1 guest',
      'avail.guest2': '2 guests',
      'avail.guest3': '3 guests',
      'avail.guest4': '4+ guests',
      'avail.consult': 'Check',

      'welcome.script': 'Welcome to',
      'welcome.desc': 'At La Gruta, every space invites you to slow down. Spacious rooms, gardens full of life, and a calm atmosphere to rest, enjoy, and experience Arequipa your own way.',

      'homemap.eyebrow': 'Why La Gruta',
      'homemap.title': 'Everything nearby. <em>No noise at all.</em>',
      'homemap.desc': 'Seven minutes on foot from Plaza de Armas, the noise is left behind. Here, the White City and calm live side by side.',
      'homemap.addressLabel': 'Address',
      'homemap.checkinLabel': 'Check-in',
      'homemap.checkoutLabel': 'Check-out',
      'homemap.directions': 'Get directions ›',

      'reviews.eyebrow': 'Guest reviews',
      'reviews.title': 'Why guests love La Gruta',
      'reviews.booking.tag': 'Fantastic',
      'reviews.booking.count': '15 reviews',
      'reviews.booking.more': 'See all on Booking.com',
      'reviews.booking.arrow': 'See more Booking.com reviews',
      'reviews.tripadvisor.count': '118 reviews',
      'reviews.tripadvisor.more': 'See all on Tripadvisor',
      'reviews.tripadvisor.arrow': 'See more TripAdvisor reviews',
      'reviews.b1.country': 'Lithuania',
      'reviews.b1.text': 'Beautiful, quiet place in Arequipa with an absolutely exceptional receptionist. Thank you so much for all your help!!',
      'reviews.b2.country': 'Chile',
      'reviews.b2.text': 'Quiet place, friendly staff, varied breakfast, comfortable beds.',
      'reviews.b3.country': 'United States',
      'reviews.b3.text': 'An amazing hotel in every way. The staff were incredibly kind and attentive, especially Alexandria and Emily.',
      'reviews.b4.country': 'Germany',
      'reviews.b4.text': 'Lovely small hotel with a beautiful garden in a great location near downtown Arequipa. Friendly staff, great breakfast, very clean.',
      'reviews.b5.country': 'Peru',
      'reviews.b5.text': 'Very peaceful and calm neighborhood, lovely room and super friendly staff.',
      'reviews.t1.text': 'Thanks to Emily and Juan for looking out for me. I have COPD and they helped me enjoy Arequipa at such high altitude.',
      'reviews.t2.text': 'The hotel is very comfortable, clean, and the staff are very attentive.',
      'reviews.t3.text': 'Excellent service, a hotel definitely worth considering, very comfortable with beautiful gardens. Thanks to Emily and Juan.',
      'reviews.t4.text': 'Clean, friendly staff, beautiful rooms, beautiful garden, great location, quiet and close to downtown.',
      'reviews.t5.text': 'We came here at the end of a three-week motorcycle trip through Peru. Lars and the staff are motorcyclists too.',

      'rooms.count': '6 room types',
      'rooms.viewAll': 'View all',
      'rooms.viewMore': 'View more',
      'rooms.book': 'Book',
      'rooms.suite.name': 'Suite',
      'rooms.suite.descShort': 'Our most spacious category, with direct garden access, fireplace and a private sitting area.',
      'rooms.suite.detail': 'Our most spacious category: direct garden access, its own fireplace and a sitting area separate from the bedroom, designed for guests staying several days who want a space to work or simply stretch out without leaving the room.',
      'rooms.matrimonial.name': 'Double Room',
      'rooms.matrimonial.descHomeShort': 'King bed and garden views to enjoy a peaceful stay as a couple.',
      'rooms.matrimonial.descShort': 'King bed and garden views for a peaceful stay as a couple.',
      'rooms.matrimonial.detail': 'King bed and garden views in a room designed for couples: the most chosen option for those coming to Arequipa to unwind without giving up comfort.',
      'rooms.semisuite.name': 'Semi Suite',
      'rooms.semisuite.descShort': 'More room to rest, with fireplace and an independent sitting area.',
      'rooms.semisuite.detail': 'A step between the classic room and the Suite: it keeps the fireplace and an independent sitting area, with a bit less floor space but the same calm garden view.',
      'rooms.triple.name': 'Triple Room',
      'rooms.triple.descShort': 'Three beds and room to rest comfortably with family or friends.',
      'rooms.triple.detail': 'Three beds in one room, ideal for traveling in a group or as a family without giving up comfort: enough space to move freely and for everyone to rest equally well.',
      'rooms.doble.name': 'Twin Room',
      'rooms.doble.descShort': 'Two beds and a calm setting to share the stay comfortably.',
      'rooms.doble.detail': 'Two separate beds in a calm setting, designed to share a room without sharing a bed: the practical choice for friends or travel companions.',
      'rooms.individual.name': 'Single Room',
      'rooms.individual.descShort': 'A practical, cozy room to rest comfortably when traveling solo.',
      'rooms.individual.detail': 'Compact and well thought out for solo travelers: everything essential within reach, with no wasted space, for those who just need a comfortable place to come back to after exploring Arequipa.',

      'jardin.title': 'A garden to unwind in',
      'jardin.desc': 'Selva Alegre holds a secret: a garden of century-old trees where only birdsong can be heard. Sunbathe on the lawn, read in the shade, or share a coffee at sunset. The garden isn’t an ornament of the hotel: it’s its heart.',

      'gastro.title': 'Your ideal breakfast awaits',
      'gastro.desc': 'Start the day facing the garden with artisan bread, seasonal fruit and freshly brewed coffee. With advance notice, you can also enjoy Arequipan dishes prepared in our kitchen.',
      'gastro.note': 'Massage service available at the hotel by appointment — arrange it at reception.',

      'faq.eyebrow': 'Help',
      'faq.title': 'Frequently asked questions',
      'faq.q1': 'What time are check-in and check-out?',
      'faq.a1': 'Check-in from 2:00 PM and check-out until 12:00 PM. If you arrive early or leave late, message us: we’ll find a way to make it work.',
      'faq.q2': 'How do I book?',
      'faq.a2': 'By WhatsApp (+51 974 330 699), through this website’s form, or by writing to lagruta@lagrutahotel.com. We confirm within 24 hours.',
      'faq.q3': 'Do you have parking?',
      'faq.a3': 'Yes, private parking inside the hotel, free of charge for our guests.',
      'faq.q4': 'Where are you located exactly?',
      'faq.a4': 'Pasaje La Gruta 304, Urb. Selva Alegre, a 7-minute walk from Plaza de Armas. We arrange transfers from the airport and the bus terminal.',
      'faq.q5': 'Can tours be arranged from the hotel?',
      'faq.a5': 'Yes. At reception we arrange city tours, Colca Canyon, rafting and more, with trusted local operators.',
      'faq.q6': 'Do you accept pets?',
      'faq.a6': 'Message us on WhatsApp and we’ll arrange it based on availability.',

      'band.title': 'Arequipa to discover.<br><em>La Gruta to enjoy.</em>',
      'band.cta': 'Book your stay',

      'footer.tagline': 'Boutique hotel · Arequipa, Peru',
      'footer.desc': 'Calm steps from Arequipa’s historic center.',
      'footer.navTitle': 'Navigation',
      'footer.contactTitle': 'Contact',
      'footer.near': 'Just a 7-minute walk from Plaza de Armas.',
      'footer.credit': 'Developed by Blanca Labz',

      'experience.eyebrow': 'The experience',
      'experience.title': 'The La Gruta Experience',
      'experience.jardines.title': 'Gardens',
      'experience.jardines.desc': 'A century-old garden where silence is felt, not just heard.',
      'experience.desayuno.title': 'Breakfast',
      'experience.desayuno.desc': 'Artisan bread and seasonal fruit, served facing the garden every morning.',
      'experience.calma.title': 'Calm',
      'experience.calma.desc': 'Time feels different when there’s no rush to get anywhere.',

      'rv.title': 'Find the ideal room for your stay.',
      'rv.desc': 'Send us your dates and preferences. We’ll help you choose the room that best suits your stay and confirm availability directly with you.',
      'rv.contact.whatsapp': 'WhatsApp',
      'rv.contact.phone': 'Phone',
      'rv.contact.email': 'Email',
      'rv.contact.checkinout': 'Check-in / out',
      'rv.form.requiredNote': 'Required fields',
      'rv.form.nombre': 'Full name',
      'rv.form.nombrePh': 'Your name',
      'rv.form.telefono': 'Phone',
      'rv.form.correo': 'Email address',
      'rv.form.correoPh': 'email@example.com',
      'rv.form.habitacion': 'Room',
      'rv.form.seleccionar': 'Select',
      'rv.form.huespedes': 'Guests',
      'rv.form.huespedesPh': '1',
      'rv.form.llegada': 'Arrival',
      'rv.form.salida': 'Departure',
      'rv.form.mensaje': 'Additional message',
      'rv.form.mensajePh': 'Any special preference?',
      'rv.form.submit': 'Check availability on WhatsApp',
      'rv.form.mailtoLink': 'I’d rather ask by email',

      'exp.eyebrow': 'Tours & adventures',
      'exp.intro': 'From reception we arrange tours, transfers and experiences with trusted local operators. We help you choose each plan and organize pickup so you can enjoy Arequipa hassle-free.',
      'exp.badge': 'Most requested',
      'exp.consultWa': 'Ask on WhatsApp',
      'exp.note': 'Reference rates per person. Before booking, we confirm availability, schedule, pickup point and included services with you.',
      'tour.colca.name': 'Colca Canyon',
      'tour.colca.desc': 'The condor’s flight at Cruz del Cóndor, hot springs in Chivay and colonial villages. Full day or 2 days/1 night.',
      'tour.colca.meta': 'from S/80',
      'tour.ciudadcampina.name': 'City & Countryside',
      'tour.ciudadcampina.desc': 'Yanahuara, the Carmen Alto viewpoint, the Mansión del Fundador and the Sabandía Mill in a single tour of the Arequipa countryside.',
      'tour.ciudadcampina.meta': '4–5 h · daily departures · from S/45',
      'tour.santacatalina.name': 'Santa Catalina Monastery',
      'tour.santacatalina.desc': 'A city within the city: colorful cloisters, sillar-stone courtyards and four centuries of history steps from Plaza de Armas.',
      'tour.santacatalina.meta': '3 h · private · from S/150',
      'tour.sillar.name': 'Sillar Stone Quarries',
      'tour.sillar.desc': 'Descend into the Añashuayco ravine, where the white stone that built the whole White City was quarried.',
      'tour.sillar.meta': '~3 h · S/45',
      'tour.rafting.name': 'Rafting on the Chili River',
      'tour.rafting.desc': 'Class II–III rapids just 20 minutes from downtown. No previous experience needed: bilingual guide and full gear included.',
      'tour.rafting.meta': '3 h · departures at 8:00, 11:00 & 14:00 · S/80',
      'tour.pillones.name': 'Pillones Waterfall',
      'tour.pillones.desc': 'A full day through the Imata Stone Forest, vicuñas in the Salinas Reserve, and viewpoints of the three volcanoes.',
      'tour.pillones.meta': 'Full day · S/80',
      'tour.volcanes.name': 'Misti & Chachani Volcanoes',
      'tour.volcanes.desc': '2-day/1-night ascent with an official UIAGM mountain guide. For those seeking the summit.',
      'tour.volcanes.meta': '2D/1N · from S/450',

      'wa.ariaLabel': 'Message us on WhatsApp',

      'modal.close': 'Close',
      'modal.prevPhoto': 'Previous photo',
      'modal.nextPhoto': 'Next photo',
      'modal.amenity.wifi': 'Free Wifi',
      'modal.amenity.water': 'Hot water 24/7',
      'modal.amenity.breakfast': 'Breakfast included',
      'modal.amenity.parking': 'Free parking',
      'modal.amenity.massage': 'Massage by appointment',
      'modal.book': 'Book this room'
    },

    nl: {
      'nav.book': '▸ Boeken',
      'menu.social.label': 'Volg ons',
      'menu.nav.home': 'Home',
      'menu.nav.rooms': 'Kamers',
      'menu.nav.reservas': 'Boeken',
      'menu.nav.experiencias': 'Ervaringen',

      'hero.home.eyebrow': 'BOETIEKHOTEL',
      'hero.home.title': 'Rust kan ook een bestemming zijn.',
      'hero.rooms.eyebrow': 'Verblijf',
      'hero.rooms.title': 'Kamers en suites om op je eigen tempo uit te rusten.',
      'hero.reservas.eyebrow': 'Boeken',
      'hero.reservas.title': 'Jouw volgende pauze begint hier.',
      'hero.experiencias.eyebrow': 'Ervaringen',
      'hero.experiencias.title1': 'Beleef Arequipa',
      'hero.experiencias.title2': 'vanuit La Gruta',

      'avail.checkin': 'Check-in',
      'avail.checkout': 'Check-out',
      'avail.guests': 'Gasten',
      'avail.guest1': '1 gast',
      'avail.guest2': '2 gasten',
      'avail.guest3': '3 gasten',
      'avail.guest4': '4+ gasten',
      'avail.consult': 'Bekijken',

      'welcome.script': 'Welkom bij',
      'welcome.desc': 'Bij La Gruta nodigt elke ruimte uit om het rustiger aan te doen. Ruime kamers, tuinen vol leven en een rustige sfeer om uit te rusten, te genieten en Arequipa op je eigen manier te beleven.',

      'homemap.eyebrow': 'Waarom La Gruta',
      'homemap.title': 'Alles dichtbij. <em>Geen enkel geluid.</em>',
      'homemap.desc': 'Zeven minuten lopen van de Plaza de Armas laat je de drukte achter je. Hier komen de Witte Stad en de rust samen.',
      'homemap.addressLabel': 'Adres',
      'homemap.checkinLabel': 'Check-in',
      'homemap.checkoutLabel': 'Check-out',
      'homemap.directions': 'Routebeschrijving ›',

      'reviews.eyebrow': 'Beoordelingen van gasten',
      'reviews.title': 'Waarom gasten dol zijn op La Gruta',
      'reviews.booking.tag': 'Fantastisch',
      'reviews.booking.count': '15 beoordelingen',
      'reviews.booking.more': 'Bekijk alles op Booking.com',
      'reviews.booking.arrow': 'Meer Booking.com-beoordelingen bekijken',
      'reviews.tripadvisor.count': '118 beoordelingen',
      'reviews.tripadvisor.more': 'Bekijk alles op Tripadvisor',
      'reviews.tripadvisor.arrow': 'Meer TripAdvisor-beoordelingen bekijken',
      'reviews.b1.country': 'Litouwen',
      'reviews.b1.text': 'Prachtige, rustige plek in Arequipa met een absoluut uitzonderlijke receptioniste. Heel erg bedankt voor alle hulp!!',
      'reviews.b2.country': 'Chili',
      'reviews.b2.text': 'Rustige plek, vriendelijk personeel, gevarieerd ontbijt, comfortabele bedden.',
      'reviews.b3.country': 'Verenigde Staten',
      'reviews.b3.text': 'Een geweldig hotel in alle opzichten. Het personeel was ongelooflijk vriendelijk en attent, vooral Alexandria en Emily.',
      'reviews.b4.country': 'Duitsland',
      'reviews.b4.text': 'Mooi, klein hotel met een prachtige tuin op een goede locatie dicht bij het centrum van Arequipa. Vriendelijk personeel, lekker ontbijt, erg schoon.',
      'reviews.b5.country': 'Peru',
      'reviews.b5.text': 'Erg rustige en vredige buurt, mooie kamer en superaardig personeel.',
      'reviews.t1.text': 'Dank aan Emily en Juan voor hun zorg. Ik heb COPD en zij hielpen me om van Arequipa te genieten op die grote hoogte.',
      'reviews.t2.text': 'Het hotel is erg comfortabel, schoon en het personeel is zeer attent.',
      'reviews.t3.text': 'Uitstekende service, een hotel om zeker te overwegen, erg comfortabel met prachtige tuinen. Dank aan Emily en Juan.',
      'reviews.t4.text': 'Schoon, vriendelijk personeel, mooie kamers, prachtige tuin, heel goede ligging, rustig en dicht bij het centrum.',
      'reviews.t5.text': 'We kwamen hier aan het einde van een motorreis van drie weken door Peru. Lars en het personeel zijn ook motorrijders.',

      'rooms.count': '6 kamertypes',
      'rooms.viewAll': 'Bekijk alles',
      'rooms.viewMore': 'Meer bekijken',
      'rooms.book': 'Boeken',
      'rooms.suite.name': 'Suite',
      'rooms.suite.descShort': 'Onze ruimste categorie, met directe toegang tot de tuin, open haard en een eigen zithoek.',
      'rooms.suite.detail': 'Onze ruimste categorie: directe toegang tot de tuin, een eigen open haard en een zithoek gescheiden van de slaapkamer, bedoeld voor wie meerdere dagen blijft en een plek wil om te werken of gewoon lekker te ontspannen zonder de kamer te verlaten.',
      'rooms.matrimonial.name': 'Tweepersoonskamer',
      'rooms.matrimonial.descHomeShort': 'Kingsize bed en uitzicht op de tuin voor een rustig verblijf als stel.',
      'rooms.matrimonial.descShort': 'Kingsize bed en tuinuitzicht voor een rustig verblijf als stel.',
      'rooms.matrimonial.detail': 'Kingsize bed en tuinuitzicht in een kamer ontworpen voor stellen: de meest gekozen optie voor wie naar Arequipa komt om tot rust te komen zonder comfort in te leveren.',
      'rooms.semisuite.name': 'Semi Suite',
      'rooms.semisuite.descShort': 'Meer ruimte om uit te rusten, met open haard en een eigen zithoek.',
      'rooms.semisuite.detail': 'Een tussenstap tussen de klassieke kamer en de Suite: met open haard en een eigen zithoek, iets minder oppervlakte maar hetzelfde rustige tuinuitzicht.',
      'rooms.triple.name': 'Driepersoonskamer',
      'rooms.triple.descShort': 'Drie bedden en ruimte om comfortabel uit te rusten met familie of vrienden.',
      'rooms.triple.detail': 'Drie bedden in één kamer, ideaal om in groep of als gezin te reizen zonder in te leveren op comfort: genoeg ruimte om je vrij te bewegen en voor iedereen om goed uit te rusten.',
      'rooms.doble.name': 'Kamer met twee bedden',
      'rooms.doble.descShort': 'Twee bedden en een rustige sfeer om het verblijf comfortabel te delen.',
      'rooms.doble.detail': 'Twee aparte bedden in een rustige sfeer, bedoeld om een kamer te delen zonder een bed te delen: de praktische keuze voor vrienden of reisgenoten.',
      'rooms.individual.name': 'Eenpersoonskamer',
      'rooms.individual.descShort': 'Een praktische, gezellige kamer om comfortabel uit te rusten tijdens een solo reis.',
      'rooms.individual.detail': 'Compact en goed doordacht voor de solo reiziger: alles binnen handbereik, zonder overbodige ruimte, voor wie gewoon een comfortabele plek nodig heeft om naar terug te keren na het verkennen van Arequipa.',

      'jardin.title': 'Een tuin om tot rust te komen',
      'jardin.desc': 'Selva Alegre herbergt een geheim: een tuin met eeuwenoude bomen waar alleen vogels te horen zijn. Zonnebaad op het gras, lees in de schaduw of drink samen een koffie bij zonsondergang. De tuin is geen decoratie van het hotel: het is het hart ervan.',

      'gastro.title': 'Jouw ideale ontbijt wacht op je',
      'gastro.desc': 'Begin de dag met uitzicht op de tuin met ambachtelijk brood, seizoensfruit en versgezette koffie. Met reservering vooraf kun je ook genieten van Arequipeense gerechten die in onze keuken worden bereid.',
      'gastro.note': 'Massagedienst beschikbaar in het hotel op afspraak — regel het bij de receptie.',

      'faq.eyebrow': 'Hulp',
      'faq.title': 'Veelgestelde vragen',
      'faq.q1': 'Hoe laat zijn de check-in en check-out?',
      'faq.a1': 'Check-in vanaf 14:00 uur en check-out tot 12:00 uur. Kom je vroeg aan of vertrek je laat, laat het ons weten: we zoeken een manier om je te ontvangen.',
      'faq.q2': 'Hoe reserveer ik?',
      'faq.a2': 'Via WhatsApp (+51 974 330 699), via het formulier op deze website of door te schrijven naar lagruta@lagrutahotel.com. We bevestigen binnen 24 uur.',
      'faq.q3': 'Hebben jullie parkeergelegenheid?',
      'faq.a3': 'Ja, privéparkeerplaats binnen het hotel, gratis voor onze gasten.',
      'faq.q4': 'Waar zijn jullie precies gevestigd?',
      'faq.a4': 'Pasaje La Gruta 304, Urb. Selva Alegre, 7 minuten lopen van de Plaza de Armas. We regelen transfers vanaf het vliegveld en het busstation.',
      'faq.q5': 'Kunnen er tours vanuit het hotel geregeld worden?',
      'faq.a5': 'Ja. Bij de receptie regelen we stadstours, Colca Canyon, rafting en meer, met vertrouwde lokale operators.',
      'faq.q6': 'Zijn huisdieren toegestaan?',
      'faq.a6': 'Stuur ons een bericht via WhatsApp en we regelen het op basis van beschikbaarheid.',

      'band.title': 'Arequipa om te ontdekken.<br><em>La Gruta om van te genieten.</em>',
      'band.cta': 'Boek je verblijf',

      'footer.tagline': 'Boetiekhotel · Arequipa, Peru',
      'footer.desc': 'Rust op loopafstand van het historische centrum van Arequipa.',
      'footer.navTitle': 'Navigatie',
      'footer.contactTitle': 'Contact',
      'footer.near': 'Slechts 7 minuten lopen van de Plaza de Armas.',
      'footer.credit': 'Ontwikkeld door Blanca Labz',

      'experience.eyebrow': 'De ervaring',
      'experience.title': 'De La Gruta-ervaring',
      'experience.jardines.title': 'Tuinen',
      'experience.jardines.desc': 'Een eeuwenoude tuin waar je de stilte voelt, niet alleen hoort.',
      'experience.desayuno.title': 'Ontbijt',
      'experience.desayuno.desc': 'Ambachtelijk brood en seizoensfruit, elke ochtend geserveerd met uitzicht op de tuin.',
      'experience.calma.title': 'Rust',
      'experience.calma.desc': 'De tijd voelt anders wanneer er geen haast is om ergens te komen.',

      'rv.title': 'Vind de ideale kamer voor je verblijf.',
      'rv.desc': 'Stuur ons je data en voorkeuren. We helpen je de kamer te kiezen die het beste bij je verblijf past en bevestigen de beschikbaarheid rechtstreeks met jou.',
      'rv.contact.whatsapp': 'WhatsApp',
      'rv.contact.phone': 'Telefoon',
      'rv.contact.email': 'E-mail',
      'rv.contact.checkinout': 'Check-in / -out',
      'rv.form.requiredNote': 'Verplichte velden',
      'rv.form.nombre': 'Volledige naam',
      'rv.form.nombrePh': 'Je naam',
      'rv.form.telefono': 'Telefoon',
      'rv.form.correo': 'E-mailadres',
      'rv.form.correoPh': 'email@voorbeeld.com',
      'rv.form.habitacion': 'Kamer',
      'rv.form.seleccionar': 'Selecteren',
      'rv.form.huespedes': 'Gasten',
      'rv.form.huespedesPh': '1',
      'rv.form.llegada': 'Aankomst',
      'rv.form.salida': 'Vertrek',
      'rv.form.mensaje': 'Aanvullend bericht',
      'rv.form.mensajePh': 'Nog een bijzondere wens?',
      'rv.form.submit': 'Beschikbaarheid via WhatsApp checken',
      'rv.form.mailtoLink': 'Ik vraag liever per e-mail',

      'exp.eyebrow': 'Tours & avonturen',
      'exp.intro': 'Vanaf de receptie regelen we tours, transfers en ervaringen met vertrouwde lokale operators. We helpen je bij het kiezen van elk plan en organiseren de ophaalservice, zodat je zonder gedoe van Arequipa kunt genieten.',
      'exp.badge': 'Meest gevraagd',
      'exp.consultWa': 'Vragen via WhatsApp',
      'exp.note': 'Richtprijzen per persoon. Voor het boeken bevestigen we samen met jou de beschikbaarheid, tijden, ophaalpunt en inbegrepen diensten.',
      'tour.colca.name': 'Colca-canyon',
      'tour.colca.desc': 'De vlucht van de condor bij Cruz del Cóndor, warmwaterbronnen in Chivay en koloniale dorpjes. Dagtrip of 2 dagen/1 nacht.',
      'tour.colca.meta': 'vanaf S/80',
      'tour.ciudadcampina.name': 'Stad & Platteland',
      'tour.ciudadcampina.desc': 'Yanahuara, het uitzichtpunt Carmen Alto, de Mansión del Fundador en de molen van Sabandía in één tocht door het Arequipeense platteland.',
      'tour.ciudadcampina.meta': '4–5 u · dagelijkse vertrekken · vanaf S/45',
      'tour.santacatalina.name': 'Santa Catalina-klooster',
      'tour.santacatalina.desc': 'Een stad binnen de stad: kleurrijke kloostergangen, binnenplaatsen van sillar-steen en vier eeuwen geschiedenis vlak bij de Plaza de Armas.',
      'tour.santacatalina.meta': '3 u · privé · vanaf S/150',
      'tour.sillar.name': 'Sillar-steengroeven',
      'tour.sillar.desc': 'Daal af naar het ravijn van Añashuayco, waar de witte steen werd gewonnen waarmee de hele Witte Stad werd gebouwd.',
      'tour.sillar.meta': '~3 u · S/45',
      'tour.rafting.name': 'Raften op de Río Chili',
      'tour.rafting.desc': 'Stroomversnellingen klasse II–III, op 20 minuten van het centrum. Geen ervaring nodig: tweetalige gids en volledige uitrusting inbegrepen.',
      'tour.rafting.meta': '3 u · vertrek om 8:00, 11:00 en 14:00 · S/80',
      'tour.pillones.name': 'Waterval van Pillones',
      'tour.pillones.desc': 'Een dagtrip langs het Stenen Bos van Imata, vicuña’s in het Salinas-reservaat en uitzichtpunten op de drie vulkanen.',
      'tour.pillones.meta': 'Dagtrip · S/80',
      'tour.volcanes.name': 'Vulkanen Misti & Chachani',
      'tour.volcanes.desc': 'Beklimming van 2 dagen/1 nacht met een officiële UIAGM-berggids. Voor wie de top wil bereiken.',
      'tour.volcanes.meta': '2D/1N · vanaf S/450',

      'wa.ariaLabel': 'Stuur een bericht via WhatsApp',

      'modal.close': 'Sluiten',
      'modal.prevPhoto': 'Vorige foto',
      'modal.nextPhoto': 'Volgende foto',
      'modal.amenity.wifi': 'Gratis wifi',
      'modal.amenity.water': '24 uur warm water',
      'modal.amenity.breakfast': 'Ontbijt inbegrepen',
      'modal.amenity.parking': 'Gratis parkeren',
      'modal.amenity.massage': 'Massage op afspraak',
      'modal.book': 'Deze kamer boeken'
    }
  };

  var currentLang = DEFAULT_LANG;
  try {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored && LANGS.indexOf(stored) !== -1) currentLang = stored;
  } catch (e) { /* localStorage bloqueado (modo privado, etc.): se queda en DEFAULT_LANG */ }

  function t(key) {
    var dict = STRINGS[currentLang] || STRINGS[DEFAULT_LANG];
    if (dict[key] !== undefined) return dict[key];
    return STRINGS[DEFAULT_LANG][key] !== undefined ? STRINGS[DEFAULT_LANG][key] : key;
  }

  function applyToDocument() {
    document.documentElement.setAttribute('lang', currentLang);

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n-html'));
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var parts = pair.split(':');
        if (parts.length !== 2) return;
        el.setAttribute(parts[0].trim(), t(parts[1].trim()));
      });
    });

    document.querySelectorAll('.menu-lang-btn').forEach(function (btn) {
      btn.classList.toggle('on', btn.getAttribute('data-lang') === currentLang);
      btn.setAttribute('aria-current', btn.getAttribute('data-lang') === currentLang ? 'true' : 'false');
    });
  }

  function setLang(lang) {
    if (LANGS.indexOf(lang) === -1 || lang === currentLang) return;
    currentLang = lang;
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* idem arriba */ }
    applyToDocument();
    document.dispatchEvent(new CustomEvent('i18n:change', { detail: { lang: lang } }));
  }

  window.I18N = { t: t, setLang: setLang, getLang: function () { return currentLang; }, LANGS: LANGS };

  applyToDocument();

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('.menu-lang-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lang')); });
    });
    // por si el DOM ya estaba listo cuando corrió applyToDocument() más
    // arriba (script con defer, suele ser el caso) hace falta reflejar el
    // estado "on" también en el primer pintado, no solo en cambios futuros.
    applyToDocument();
  });
})();
