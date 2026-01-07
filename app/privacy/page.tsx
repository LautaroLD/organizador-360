import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Política de Privacidad',
  description: 'Política de privacidad de nuestra aplicación organizadora',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Política de Privacidad</h1>

      <div className="space-y-6 text-gray-700 dark:text-gray-300">
        <section>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Última actualización: 7 de enero de 2026
          </p>
          <p>
            Esta Política de Privacidad describe cómo recopilamos, usamos y protegemos su información
            personal cuando utiliza nuestra aplicación organizadora de proyectos y tareas.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">1. Información que Recopilamos</h2>
          <h3 className="text-xl font-medium mb-2">1.1 Información de Cuenta</h3>
          <p className="mb-4">
            Cuando crea una cuenta, recopilamos:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Dirección de correo electrónico</li>
            <li>Nombre de usuario</li>
            <li>Contraseña (encriptada)</li>
            <li>Información de perfil opcional</li>
          </ul>

          <h3 className="text-xl font-medium mb-2">1.2 Información de Google Calendar</h3>
          <p className="mb-4">
            Si conecta su cuenta de Google Calendar, accedemos a:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Eventos de calendario (lectura y escritura)</li>
            <li>Información básica de perfil de Google</li>
            <li>Dirección de correo electrónico asociada a su cuenta de Google</li>
          </ul>

          <h3 className="text-xl font-medium mb-2">1.3 Datos de Uso</h3>
          <p className="mb-4">
            Recopilamos información sobre cómo usa la aplicación:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Proyectos, tareas y recursos creados</li>
            <li>Actividad de colaboración con otros usuarios</li>
            <li>Preferencias y configuraciones</li>
            <li>Información de dispositivo y navegador</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">2. Cómo Usamos su Información</h2>
          <p className="mb-4">Utilizamos la información recopilada para:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Proporcionar y mejorar nuestros servicios</li>
            <li>Sincronizar sus tareas con Google Calendar</li>
            <li>Facilitar la colaboración en proyectos</li>
            <li>Enviar notificaciones sobre actualizaciones y actividades</li>
            <li>Mantener la seguridad de su cuenta</li>
            <li>Cumplir con obligaciones legales</li>
            <li>Analizar y mejorar el rendimiento de la aplicación</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">3. Integración con Google Calendar</h2>
          <p className="mb-4">
            <strong>Uso de la API de Google Calendar:</strong>
          </p>
          <p className="mb-4">
            Nuestra aplicación utiliza la API de Google Calendar para:
          </p>
          <ul className="list-disc pl-6 space-y-2 mb-4">
            <li>Crear eventos desde tareas de la aplicación</li>
            <li>Visualizar sus eventos de calendario dentro de nuestra interfaz</li>
            <li>Sincronizar cambios entre la aplicación y Google Calendar</li>
          </ul>
          <p className="mb-4">
            <strong>Importante:</strong> Solo accedemos a la información de Google Calendar que usted
            autoriza explícitamente. Puede revocar el acceso en cualquier momento desde la configuración
            de su cuenta de Google.
          </p>
          <p className="mb-4">
            El uso que hacemos de la información recibida de las APIs de Google cumple con la{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              Política de Datos de Usuario de los Servicios API de Google
            </a>
            , incluidos los requisitos de Uso Limitado.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">4. Compartir Información</h2>
          <p className="mb-4">
            No vendemos ni compartimos su información personal con terceros, excepto:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Con miembros de proyectos cuando colabora en equipo</li>
            <li>Con proveedores de servicios que nos ayudan a operar la aplicación (por ejemplo, hosting)</li>
            <li>Cuando sea requerido por ley o para proteger nuestros derechos legales</li>
            <li>Con su consentimiento explícito</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">5. Seguridad de Datos</h2>
          <p className="mb-4">
            Implementamos medidas de seguridad técnicas y organizativas para proteger sus datos:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Encriptación de datos en tránsito (HTTPS/SSL)</li>
            <li>Encriptación de contraseñas</li>
            <li>Acceso restringido a datos personales</li>
            <li>Auditorías de seguridad regulares</li>
            <li>Copias de seguridad automáticas</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">6. Retención de Datos</h2>
          <p>
            Conservamos su información personal mientras su cuenta esté activa o según sea necesario
            para proporcionar servicios. Puede solicitar la eliminación de su cuenta y datos en cualquier
            momento desde la configuración de la aplicación o contactándonos directamente.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">7. Sus Derechos</h2>
          <p className="mb-4">Usted tiene derecho a:</p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Acceder a sus datos personales</li>
            <li>Corregir información inexacta</li>
            <li>Solicitar la eliminación de sus datos</li>
            <li>Exportar sus datos</li>
            <li>Revocar el acceso a Google Calendar</li>
            <li>Desactivar notificaciones</li>
            <li>Eliminar su cuenta</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">8. Cookies y Tecnologías Similares</h2>
          <p className="mb-4">
            Utilizamos cookies y tecnologías similares para:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Mantener su sesión activa</li>
            <li>Recordar sus preferencias</li>
            <li>Analizar el uso de la aplicación</li>
            <li>Mejorar la experiencia del usuario</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">9. Menores de Edad</h2>
          <p>
            Nuestro servicio no está dirigido a menores de 13 años. No recopilamos intencionalmente
            información personal de menores. Si descubrimos que hemos recopilado datos de un menor,
            eliminaremos esa información de inmediato.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">10. Cambios a esta Política</h2>
          <p>
            Podemos actualizar esta Política de Privacidad ocasionalmente. Le notificaremos sobre
            cambios significativos publicando la nueva política en esta página y actualizando la
            fecha de &quot;Última actualización&quot;. Le recomendamos revisar esta política periódicamente.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">11. Contacto</h2>
          <p className="mb-4">
            Si tiene preguntas sobre esta Política de Privacidad o sobre cómo manejamos sus datos,
            puede contactarnos a través de:
          </p>
          <ul className="list-disc pl-6 space-y-2">
            <li>Correo electrónico: duranlautarogabriel@gmail.com</li>
            <li>Configuración de la aplicación: Sección de soporte</li>
          </ul>
        </section>

        <section className="border-t pt-6 mt-8">
          <h2 className="text-2xl font-semibold mb-4">Declaración de Uso Limitado de Google</h2>
          <p className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            El uso que hace esta aplicación de la información recibida de las APIs de Google se
            adherirá a la{' '}
            <a
              href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline font-medium"
            >
              Política de Datos de Usuario de los Servicios API de Google
            </a>
            , incluidos los requisitos de Uso Limitado.
          </p>
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
