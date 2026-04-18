import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Términos de Servicio | Veenzo',
  description: 'Términos de servicio de Veenzo, plataforma de gestión de proyectos y tareas.',
};

export default function TermsOfServicePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Términos de Servicio</h1>

      <div className="space-y-6 text-gray-700 dark:text-gray-300">
        <section>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Última actualización: 17 de abril de 2026
          </p>
          <p>
            Bienvenido a <strong>Veenzo</strong>, plataforma de gestión de proyectos y colaboración en equipo. Al acceder o utilizar
            nuestro servicio, usted acepta estar sujeto a estos Términos de Servicio.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Aceptación de los Términos</h2>
          <p>
            Al crear una cuenta y utilizar nuestro servicio, usted acepta cumplir con estos términos.
            Si no está de acuerdo con alguna parte de estos términos, no debe utilizar nuestro servicio.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Descripción del Servicio</h2>
          <p className="mb-4">
            Proporcionamos una plataforma para:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Organizar y gestionar proyectos y tareas</li>
            <li>Colaborar con otros usuarios</li>
            <li>Sincronizar con Google Calendar</li>
            <li>Gestionar recursos y etiquetas</li>
            <li>Recibir notificaciones sobre actividades</li>
            <li>Asistencia mediante inteligencia artificial (IA) a través de la API de Google Gemini</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Cuentas de Usuario</h2>
          <h3 className="text-xl font-medium mb-2">3.1 Registro</h3>
          <p className="mb-4">
            Para utilizar el servicio, debe crear una cuenta proporcionando información precisa y completa.
            Usted es responsable de mantener la confidencialidad de su contraseña.
          </p>
          <h3 className="text-xl font-medium mb-2">3.2 Responsabilidad</h3>
          <p>
            Usted es responsable de todas las actividades que ocurran en su cuenta. Debe notificarnos
            inmediatamente sobre cualquier uso no autorizado de su cuenta.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Uso Aceptable</h2>
          <p className="mb-4">Usted se compromete a:</p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Usar el servicio solo para fines legales</li>
            <li>No intentar acceder a cuentas de otros usuarios</li>
            <li>No cargar contenido malicioso o ilegal</li>
            <li>No abusar o sobrecargar nuestros sistemas</li>
            <li>Respetar los derechos de propiedad intelectual</li>
            <li>No utilizar el servicio para spam o actividades no autorizadas</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Integración con Google</h2>
          <p className="mb-4">
            Al conectar su cuenta de Google Calendar:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Autoriza a nuestra aplicación a acceder a su Google Calendar según los permisos solicitados</li>
            <li>Acepta que sincronizaremos datos entre nuestra aplicación y Google Calendar</li>
            <li>Puede revocar el acceso en cualquier momento desde la configuración de Google</li>
            <li>Reconoce que el servicio de Google está sujeto a los términos de Google</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5.5 Inteligencia Artificial (Gemini)</h2>
          <p className="mb-4">
            Veenzo ofrece funciones de asistencia con IA en planes pagos (Pro y superiores) mediante la API de Google Gemini:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Para generar sugerencias, resumir conversaciones o crear tareas, se envían fragmentos del contenido de sus proyectos a la API de Gemini</li>
            <li>Dicho contenido puede incluir nombres de tareas, descripciones, mensajes de chat y estado del proyecto</li>
            <li>No se envían datos de pago, contraseñas ni información sensible de terceros</li>
            <li>Google puede procesar estos datos conforme a sus propias políticas de uso de la API</li>
            <li>Puede desactivar las funciones de IA desde la configuración del proyecto</li>
          </ul>
          <p>
            Al utilizar funciones de IA, usted acepta que fragmentos de su contenido sean procesados por Google Gemini para generar las respuestas correspondientes.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Suscripciones y Pagos</h2>
          <p className="mb-4">
            Ofrecemos planes de suscripción con diferentes características:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Los pagos se procesan de forma segura a través de Mercado Pago</li>
            <li>Las suscripciones son de facturación mensual y se renuevan automáticamente</li>
            <li>Puede cancelar su suscripción en cualquier momento; el acceso continúa hasta el fin del período pagado</li>
            <li>No se emiten reembolsos por períodos no utilizados, salvo que la ley lo requiera</li>
            <li>Al suscribirse, sus datos de pago son procesados directamente por Mercado Pago conforme a sus propios términos</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Propiedad Intelectual</h2>
          <p className="mb-4">
            <strong>Nuestro Contenido:</strong> El servicio, incluyendo diseño, características y
            código fuente, es propiedad nuestra y está protegido por leyes de propiedad intelectual.
          </p>
          <p>
            <strong>Su Contenido:</strong> Usted conserva todos los derechos sobre el contenido que
            crea (proyectos, tareas, recursos). Nos otorga una licencia para almacenar y mostrar ese
            contenido según sea necesario para proporcionar el servicio.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Limitación de Responsabilidad</h2>
          <p className="mb-4">
            El servicio se proporciona &quot;tal cual&quot; y &quot;según disponibilidad&quot;. No garantizamos que:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>El servicio será ininterrumpido o libre de errores</li>
            <li>Los resultados obtenidos del uso del servicio serán precisos o confiables</li>
            <li>Se corregirán todos los defectos</li>
          </ul>
          <p>
            No seremos responsables por daños indirectos, incidentales o consecuentes resultantes
            del uso o la imposibilidad de usar el servicio.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">9. Privacidad</h2>
          <p>
            El uso de nuestro servicio también está regido por nuestra{' '}
            <a
              href="/privacy"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Política de Privacidad
            </a>
            , que describe cómo recopilamos y usamos su información personal.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">10. Terminación</h2>
          <p className="mb-4">
            Podemos suspender o terminar su cuenta si:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Viola estos Términos de Servicio</li>
            <li>Su uso del servicio causa daño a otros usuarios o a nuestra infraestructura</li>
            <li>Es requerido por ley</li>
          </ul>
          <p>
            Usted puede cancelar su cuenta en cualquier momento desde la configuración de la aplicación.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">11. Modificaciones</h2>
          <p>
            Nos reservamos el derecho de modificar estos términos en cualquier momento. Le notificaremos
            sobre cambios significativos. Su uso continuado del servicio después de dichos cambios
            constituye su aceptación de los nuevos términos.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">12. Ley Aplicable</h2>
          <p>
            Estos términos se regirán e interpretarán de acuerdo con las leyes de la República Argentina,
            en particular la Ley 24.240 de Defensa del Consumidor y la Ley 25.326 de Protección de Datos Personales.
            Cualquier disputa será sometida a la jurisdicción de los tribunales ordinarios de la Ciudad Autónoma de Buenos Aires.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">13. Contacto</h2>
          <p className="mb-4">
            Si tiene preguntas sobre estos Términos de Servicio, puede contactarnos a través de:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Correo electrónico: duranlautarogabriel@gmail.com</li>
            <li>Configuración de la aplicación: Sección de soporte</li>
          </ul>
        </section>
      </div>

      <div className="mt-12 pt-6 border-t text-center">
        <Link
          href="/"
          className="text-blue-600 dark:text-blue-400 hover:underline"
        >
          ← Volver al inicio
        </Link>
      </div>
    </div>
  );
}
