/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { preapproval, customer, card } from '@/lib/mercadopago';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { cardTokenId, payerEmail } = await request.json();
    const targetPlanId = process.env.MP_PRO_PLAN_ID;

    // Email de facturación: Preferir el del formulario (payerEmail) para permitir pruebas
    // En producción idealmente validamos que coincida, pero en Sandbox necesitamos flexibilidad
    // const billingEmail = payerEmail || 'fallback@email.com'; 
    
    if (!targetPlanId) {
      return NextResponse.json(
        { error: 'ID del plan de suscripción no configurado (MP_PRO_PLAN_ID)' },
        { status: 500 }
      );
    }

    /* 
       CAMBIO: Hacemos opcional el token de tarjeta.
       Si NO viene token, asumimos flujo "Checkout Pro" (Redirección).
       Si viene token, intentamos flujo "API" (Transparente).
    */
    /*
    if (!cardTokenId) {
      return NextResponse.json(
        { error: 'Token de tarjeta requerido' },
        { status: 400 }
      );
    }
    */

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }

    // Obtener datos del usuario de Supabase
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('email, name, id, mercadopago_customer_id')
      .eq('id', user.id)
      .single();

    if (userError || !userData) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 404 }
      );
    }

    // Detectar si estamos en modo TEST (sandbox)
    // Hay dos tipos de credenciales de prueba:
    // 1. TEST-xxx: Credenciales de prueba de tu cuenta REAL
    // 2. APP_USR-xxx de cuenta test_user: Credenciales de producción pero de cuenta de prueba
    // En AMBOS casos, NO podemos usar la Customer API
    const accessToken = process.env.MP_ACCESS_TOKEN || '';
    const isTestCredentials = accessToken.startsWith('TEST-');
    
    // También detectamos si el nickname sugiere cuenta test_user (se detectará en runtime si es necesario)
    // Por ahora, asumimos que si NO es TEST- pero queremos probar, usamos redirección
    // La forma más segura: Usar una variable de entorno para forzar modo sandbox
    const forceSandbox = process.env.MP_SANDBOX_MODE === 'true';
    const isTestMode = isTestCredentials || forceSandbox;

    // Gestión del Customer de Mercado Pago
    // IMPORTANTE: En modo TEST o sandbox, NO gestionamos Customers.
    // Las cuentas test_user no tienen acceso a la Customer API.
    let mpCustomerId = null;

    if (!isTestMode) {
      // Solo gestionar customers en PRODUCCIÓN
      mpCustomerId = userData.mercadopago_customer_id;

      // VALIDACIÓN DE CUSTOMER ID PREVIO
      if (mpCustomerId) {
          try {
              await customer.get({ customerId: mpCustomerId });
              console.log(`Customer ${mpCustomerId} verificado exitosamente.`);
          } catch (error: any) {
              console.warn(`Customer ID ${mpCustomerId} almacenado no es válido. Se creará uno nuevo.`);
              mpCustomerId = null;
          }
      }

      if (!mpCustomerId) {
        try {
          const customerSearch = await customer.search({ options: { email: user.email } });
          
          if (customerSearch.results && customerSearch.results.length > 0) {
            mpCustomerId = customerSearch.results[0].id;
          } else {
            const nameParts = (userData.name || 'User').trim().split(/\s+/);
            const firstName = nameParts[0];
            const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
 
            const customerBody: any = {
              email: user.email,
              first_name: firstName,
            };
            if (lastName) {
               customerBody.last_name = lastName;
            }

            const newCustomer = await customer.create({
              body: customerBody
            });
            mpCustomerId = newCustomer.id;
          }

          if (mpCustomerId) {
            await supabase
              .from('users')
              .update({ mercadopago_customer_id: mpCustomerId })
              .eq('id', user.id);
          }
           
        } catch (error: any) {
          console.error('Error gestionando customer MP:', JSON.stringify(error, null, 2));
          if (error.status === 401 || error.status === 403) {
              return NextResponse.json(
                  { error: 'Error de configuración en Mercado Pago. Revisa logs.' },
                  { status: 500 }
              );
          }
        }
      }
    } else {
      console.log('[TEST MODE] Omitiendo gestión de Customer. El usuario usará su cuenta test_user en el checkout.');
    }

    console.log('Intentando crear suscripción con:', { 
        planId: targetPlanId, 
        cardTokenLength: cardTokenId?.length,
        hasCustomerId: !!mpCustomerId,
        isTestMode 
    });

    // En modo TEST, usar SIEMPRE el flujo de redirección directa al Plan
    // Esto evita el error "una de las partes es de prueba" porque:
    // 1. No creamos Customer desde el backend con email de cuenta real
    // 2. El usuario inicia sesión con su cuenta test_user directamente en el checkout de MP
    // 3. La tarjeta se ingresa en el checkout de MP, no tokenizada desde el frontend
    if (isTestMode) {
      console.log('[TEST MODE] Usando flujo de redirección directa al Plan de Suscripción.');
      return NextResponse.json({ 
         id: 'test_plan_redirect', 
         status: 'pending',
         init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${targetPlanId}`
      });
    }

    // --- FLUJO DE PRODUCCIÓN ---
    if (!mpCustomerId) {
         console.warn('ADVERTENCIA: Creando suscripción en PRODUCCIÓN sin Customer ID asociado. Riesgo de rechazo por seguridad.');
    }

    let usedCardId = null;

    // INTENTO DE VINCULACIÓN DE TARJETA (Solo si hay token y Customer)
    if (mpCustomerId && cardTokenId) {
        try {
            console.log(`[BACKEND] Intentando guardar tarjeta para Customer ${mpCustomerId} con token ${cardTokenId.substring(0, 10)}...`);
            const savedCard = await card.create({
                customerId: mpCustomerId,
                body: {
                    token: cardTokenId
                }
            });
            usedCardId = savedCard.id;
            console.log('[BACKEND] Tarjeta guardada exitosamente. Card ID:', usedCardId);
             
        } catch (cardError: any) {
            console.error('[BACKEND] Error guardando tarjeta en Customer:', JSON.stringify(cardError, null, 2));
            
            // Si el error es 404, confirmar el diagnóstico
            if (cardError.status === 404) {
                 console.error('[BACKEND] DIAGNÓSTICO FINAL: El token de tarjeta no es visible para este Access Token. CONFIRMADO ERROR DE CREDENCIALES CRUZADAS.');
            }
        }
    } else {
        console.log('[BACKEND] No se intentó guardar tarjeta. mpCustomerId:', mpCustomerId, 'cardTokenId:', !!cardTokenId);
    }

    // Configurar body básico de suscripción
    const subscriptionBody: any = {
         preapproval_plan_id: targetPlanId,
         payer_email: payerEmail || user.email,
         external_reference: user.id || 'NO_REF', 
         back_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
    };

    if (usedCardId) {
        // [Opción A - API] Tenemos tarjeta guardada
        subscriptionBody.card_id = usedCardId;
        subscriptionBody.payer_id = mpCustomerId; 
        subscriptionBody.status = 'authorized';
    } else if (cardTokenId) {
        // [Opción B - API] Token directo (Fallback)
        subscriptionBody.card_token_id = cardTokenId;
        subscriptionBody.status = 'authorized';
    } 
    // [Opción C - Checkout Pro]
    // Si no enviamos tarjeta, intentamos obtener el init_point.
    // IMPORTANTE: preapproval.create() a menudo falla si no se envía tarjeta.
    // Si eso pasa, construiremos el link manualmente usando el preapproval_plan_id.

    console.log('Environment Check:', { 
      isTestMode: isTestMode, 
      tokenPrefix: accessToken.substring(0, 5) 
    });
    console.log('Sending Body:', JSON.stringify(subscriptionBody, null, 2));

    let subscription;
    try {
        subscription = await preapproval.create({
          body: subscriptionBody
        });
    } catch (createError: any) {
        // Fallback para error "card_token_id is required" en Checkout Pro
        if (createError.status === 400 && !cardTokenId) {
             console.warn('Fallo preapproval.create por falta de tarjeta. Usando Fallback a Link de Plan.');
             
             // Opción C.2: Retornar el Init Point del Plan directamente
             return NextResponse.json({ 
                id: 'legacy_plan_flow', 
                status: 'pending',
                init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${targetPlanId}`
             });
        }
        throw createError;
    }

    console.log('Suscripción creada:', subscription.id);

    // Guardar suscripción en BD local
    // Nota: El estado inicial suele ser 'authorized'.
    // Mapear estado de MP a los permitidos en BD (ver migración)
    const status = subscription.status === 'authorized' ? 'active' : subscription.status;

    await supabase.from('subscriptions').upsert({
      id: subscription.id!, // Usamos el ID de la suscripción de MercadoPago como PK
      user_id: user.id,
      status: status, // active/authorized
      price_id: targetPlanId,
      mercadopago_subscription_id: subscription.id,
      created: new Date().toISOString(),
      current_period_start: new Date().toISOString(), // aproximado
      current_period_end: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(), // +1 mes (asumiendo mensual)
      // Otros campos...
    });

    return NextResponse.json({ 
      id: subscription.id, 
      status: subscription.status,
      init_point: subscription.init_point // Por si acaso (aunque authorized ya debería estar lista)
    });

  } catch (error: any) {
    console.error('Error creando suscripción MP:', JSON.stringify(error, null, 2));
    
    // Si hay causas detalladas, mostrarlas
    if (error.cause) {
        console.error('Causas del error:', JSON.stringify(error.cause, null, 2));
    }

    return NextResponse.json(
      { error: error.message || 'Error al procesar la suscripción' },
      { status: 500 }
    );
  }
}
