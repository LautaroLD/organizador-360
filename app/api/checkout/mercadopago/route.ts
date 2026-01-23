/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@/lib/supabase/server';
import { preapproval, customer, card } from '@/lib/mercadopago';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
      const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
    }
        const targetPlanId = process.env.MP_PRO_PLAN_ID;
        return NextResponse.json({
                init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${targetPlanId}`
  });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Error al procesar la suscripción' },
      { status: 500 }
    );
  }
  // try {
  //   const { cardTokenId, payerEmail } = await request.json();
  //   const targetPlanId = process.env.MP_PRO_PLAN_ID;

  //   // Email de facturación: Preferir el del formulario (payerEmail) para permitir pruebas
  //   // En producción idealmente validamos que coincida, pero en Sandbox necesitamos flexibilidad
  //   // const billingEmail = payerEmail || 'fallback@email.com'; 
    
  //   if (!targetPlanId) {
  //     return NextResponse.json(
  //       { error: 'ID del plan de suscripción no configurado (MP_PRO_PLAN_ID)' },
  //       { status: 500 }
  //     );
  //   }

  //   /* 
  //      CAMBIO: Hacemos opcional el token de tarjeta.
  //      Si NO viene token, asumimos flujo "Checkout Pro" (Redirección).
  //      Si viene token, intentamos flujo "API" (Transparente).
  //   */
  //   /*
  //   if (!cardTokenId) {
  //     return NextResponse.json(
  //       { error: 'Token de tarjeta requerido' },
  //       { status: 400 }
  //     );
  //   }
  //   */

  //   const supabase = await createClient();
  //   const {
  //     data: { user },
  //   } = await supabase.auth.getUser();

  //   if (!user || !user.email) {
  //     return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  //   }

  //   // Obtener datos del usuario de Supabase
  //   const { data: userData, error: userError } = await supabase
  //     .from('users')
  //     .select('email, name, id, mercadopago_customer_id')
  //     .eq('id', user.id)
  //     .single();

  //   if (userError || !userData) {
  //     return NextResponse.json(
  //       { error: 'Usuario no encontrado' },
  //       { status: 404 }
  //     );
  //   }

  //   // Detectar si estamos en modo TEST (sandbox)
  //   // Hay dos tipos de credenciales de prueba:
  //   // 1. TEST-xxx: Credenciales de prueba de tu cuenta REAL
  //   // 2. APP_USR-xxx de cuenta test_user: Credenciales de producción pero de cuenta de prueba
  //   // En AMBOS casos, NO podemos usar la Customer API
  //   const accessToken = process.env.MP_ACCESS_TOKEN || '';
  //   const isTestCredentials = accessToken.startsWith('TEST-');
    
  //   // También detectamos si el nickname sugiere cuenta test_user (se detectará en runtime si es necesario)
  //   // Por ahora, asumimos que si NO es TEST- pero queremos probar, usamos redirección
  //   // La forma más segura: Usar una variable de entorno para forzar modo sandbox
  //   const forceSandbox = process.env.MP_SANDBOX_MODE === 'true';
  //   const isTestMode = isTestCredentials || forceSandbox;

  //   // Gestión del Customer de Mercado Pago
  //   // IMPORTANTE: En modo TEST o sandbox, NO gestionamos Customers.
  //   // Las cuentas test_user no tienen acceso a la Customer API.
  //   let mpCustomerId = null;

  //   if (!isTestMode) {
  //     // Solo gestionar customers en PRODUCCIÓN
  //     mpCustomerId = userData.mercadopago_customer_id;

  //     // VALIDACIÓN DE CUSTOMER ID PREVIO
  //     if (mpCustomerId) {
  //         try {
  //             await customer.get({ customerId: mpCustomerId });
  //             console.log(`Customer ${mpCustomerId} verificado exitosamente.`);
  //         } catch (error: any) {
  //             console.warn(`Customer ID ${mpCustomerId} almacenado no es válido. Se creará uno nuevo.`);
  //             mpCustomerId = null;
  //         }
  //     }

  //     if (!mpCustomerId) {
  //       try {
  //         const customerSearch = await customer.search({ options: { email: user.email } });
          
  //         if (customerSearch.results && customerSearch.results.length > 0) {
  //           mpCustomerId = customerSearch.results[0].id;
  //         } else {
  //           const nameParts = (userData.name || 'User').trim().split(/\s+/);
  //           const firstName = nameParts[0];
  //           const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;
 
  //           const customerBody: any = {
  //             email: user.email,
  //             first_name: firstName,
  //           };
  //           if (lastName) {
  //              customerBody.last_name = lastName;
  //           }

  //           const newCustomer = await customer.create({
  //             body: customerBody
  //           });
  //           mpCustomerId = newCustomer.id;
  //         }

  //         if (mpCustomerId) {
  //           await supabase
  //             .from('users')
  //             .update({ mercadopago_customer_id: mpCustomerId })
  //             .eq('id', user.id);
  //         }
           
  //       } catch (error: any) {
  //         console.error('Error gestionando customer MP:', JSON.stringify(error, null, 2));
  //         if (error.status === 401 || error.status === 403) {
  //             return NextResponse.json(
  //                 { error: 'Error de configuración en Mercado Pago. Revisa logs.' },
  //                 { status: 500 }
  //             );
  //         }
  //       }
  //     }
  //   } else {
  //     console.log('[TEST MODE] Omitiendo gestión de Customer. El usuario usará su cuenta test_user en el checkout.');
  //   }

  //   console.log('Intentando crear suscripción con:', { 
  //       planId: targetPlanId, 
  //       cardTokenLength: cardTokenId?.length,
  //       hasCustomerId: !!mpCustomerId,
  //       isTestMode 
  //   });

  //   /*
  //   // --- BYPASS ELIMINADO ---
  //   // Usamos el flujo API siempre que sea posible para mantener external_reference
  //   */

  //   // --- FLUJO DE PRODUCCIÓN / TEST UNIFICADO ---
  //   if (!mpCustomerId) {
  //        console.warn('ADVERTENCIA: Creando suscripción en PRODUCCIÓN sin Customer ID asociado. Riesgo de rechazo por seguridad.');
  //   }

  //   let usedCardId = null;

  //   // INTENTO DE VINCULACIÓN DE TARJETA (Solo si hay token y Customer)
  //   if (mpCustomerId && cardTokenId) {
  //       try {
  //           console.log(`[BACKEND] Intentando guardar tarjeta para Customer ${mpCustomerId} con token ${cardTokenId.substring(0, 10)}...`);
  //           const savedCard = await card.create({
  //               customerId: mpCustomerId,
  //               body: {
  //                   token: cardTokenId
  //               }
  //           });
  //           usedCardId = savedCard.id;
  //           console.log('[BACKEND] Tarjeta guardada exitosamente. Card ID:', usedCardId);
             
  //       } catch (cardError: any) {
  //           console.error('[BACKEND] Error guardando tarjeta en Customer:', JSON.stringify(cardError, null, 2));
            
  //           // Si el error es 404, confirmar el diagnóstico
  //           if (cardError.status === 404) {
  //                console.error('[BACKEND] DIAGNÓSTICO FINAL: El token de tarjeta no es visible para este Access Token. CONFIRMADO ERROR DE CREDENCIALES CRUZADAS.');
  //           }
  //       }
  //   } else {
  //       console.log('[BACKEND] No se intentó guardar tarjeta. mpCustomerId:', mpCustomerId, 'cardTokenId:', !!cardTokenId);
  //   }

  //   // --- GENERACIÓN DE PREAPPROVAL (Suscripción) ---
  //   // Intentamos crear la suscripción vía API para tener control total id y external_reference.
  //   // Esto aplica tanto para producción donde vinculamos tarjeta, como para redirección (sin tarjeta)
  //   // El "status" pending o authorized determina si es cobro inmediato o link de pago.

  //   const subscriptionBody: any = {
  //        preapproval_plan_id: targetPlanId,
  //        payer_email: payerEmail || user.email,
  //        external_reference: user.id, // CRUCIAL: Vincula usuario con MP
  //        back_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  //        reason: 'Suscripción Pro' // Opcional
  //   };

  //   if (usedCardId) {
  //       // [Opción A - API] Tenemos tarjeta guardada
  //       subscriptionBody.card_id = usedCardId;
  //       subscriptionBody.payer_id = mpCustomerId; 
  //       subscriptionBody.status = 'authorized';
  //   } else if (cardTokenId) {
  //       // [Opción B - API] Token directo (Fallback)
  //       subscriptionBody.card_token_id = cardTokenId;
  //       subscriptionBody.status = 'authorized';
  //   } else {
  //       // [Opción C - Redirección] Sin tarjeta
  //       // Dejar status undefined o pending genera un init_point 
  //       // y NO requiere card_token_id.
  //       subscriptionBody.status = 'pending';
  //   }

  //   console.log('Environment Check:', { 
  //     isTestMode: isTestMode, 
  //     tokenPrefix: accessToken.substring(0, 5) 
  //   });
  //   console.log('Sending Body:', JSON.stringify(subscriptionBody, null, 2));

  //   let subscription;
  //   try {
  //       subscription = await preapproval.create({
  //         body: subscriptionBody
  //       });
  //   } catch (createError: any) {
  //       // Fallback EXTREMO: Si falla API, regresamos link simple pero PERDEMOS rastreo
  //       // Solo como última opción. 
  //       console.error('Fallo preapproval.create:', JSON.stringify(createError, null, 2));
        
  //       if (!cardTokenId) {
  //            console.warn('Usando Fallback a Link de Plan (Se pierde external_reference).');
  //            return NextResponse.json({ 
  //               id: 'legacy_plan_flow', 
  //               status: 'pending',
  //               init_point: `https://www.mercadopago.com.ar/subscriptions/checkout?preapproval_plan_id=${targetPlanId}`
  //            });
  //       }
  //       throw createError;
  //   }

  //   console.log('Suscripción creada:', subscription.id);

  //   // Guardar suscripción en BD local INMEDIATAMENTE
  //   // Esto asegura que "pendiente" exista antes de que el usuario vaya a pagar.
  //   const status = subscription.status === 'authorized' ? 'active' : subscription.status;

  //   const { error: upsertError } = await supabase.from('subscriptions').upsert({
  //     id: subscription.id!, 
  //     user_id: user.id,
  //     status: status, 
  //     price_id: targetPlanId,
  //     mercadopago_subscription_id: subscription.id,
  //     created: new Date().toISOString(),
  //     current_period_start: new Date().toISOString(), 
  //     current_period_end: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString(),
  //   });

  //   if (upsertError) {
  //       console.error('Error guardando suscripción local:', upsertError);
  //       // No bloqueamos el flujo, pero es grave.
  //   }

  //   return NextResponse.json({ 
  //     id: subscription.id, 
  //     status: subscription.status,
  //     init_point: subscription.init_point 
  //   });

  // } catch (error: any) {
  //   console.error('Error creando suscripción MP:', JSON.stringify(error, null, 2));
    
  //   // Si hay causas detalladas, mostrarlas
  //   if (error.cause) {
  //       console.error('Causas del error:', JSON.stringify(error.cause, null, 2));
  //   }

  //   return NextResponse.json(
  //     { error: error.message || 'Error al procesar la suscripción' },
  //     { status: 500 }
  //   );
  // }
}
