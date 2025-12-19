import Stripe from 'stripe';

// Usa la última versión soportada por el SDK; si se deja vacío, Stripe usa la default del SDK.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  // apiVersion: undefined, // utiliza la versión por defecto del SDK
});
