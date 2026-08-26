import { Routes } from '@angular/router';
import { authGuard, guestGuard } from '@pc/core';

/**
 * Browsing is open to everyone. Only the steps that need an identity — checkout,
 * order history, the account page — sit behind the guard.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/home-page').then((m) => m.HomePage),
    title: 'FreshKart — Food & fresh vegetables, delivered',
  },
  {
    path: 'menu',
    loadComponent: () => import('./pages/catalog-page').then((m) => m.CatalogPage),
    title: 'Browse — FreshKart',
  },
  {
    path: 'menu/:categoryId',
    loadComponent: () => import('./pages/catalog-page').then((m) => m.CatalogPage),
  },
  {
    path: 'product/:productId',
    loadComponent: () => import('./pages/product-page').then((m) => m.ProductPage),
  },
  {
    path: 'cart',
    loadComponent: () => import('./pages/cart-page').then((m) => m.CartPage),
    title: 'Your cart — FreshKart',
  },
  {
    path: 'checkout',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/checkout-page').then((m) => m.CheckoutPage),
    title: 'Checkout — FreshKart',
  },
  {
    path: 'pay/:orderId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/payment-page').then((m) => m.PaymentPage),
    title: 'Payment — FreshKart',
  },
  {
    path: 'order/:orderId',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/order-page').then((m) => m.OrderPage),
    title: 'Track order — FreshKart',
  },
  {
    path: 'orders',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/orders-page').then((m) => m.OrdersPage),
    title: 'Your orders — FreshKart',
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/account-page').then((m) => m.AccountPage),
    title: 'Account — FreshKart',
  },
  {
    path: '',
    canActivate: [guestGuard],
    children: [
      {
        path: 'login',
        loadComponent: () => import('./pages/login-page').then((m) => m.ShopLoginPage),
        title: 'Sign in — FreshKart',
      },
      {
        path: 'register',
        loadComponent: () => import('./pages/register-page').then((m) => m.ShopRegisterPage),
        title: 'Create an account — FreshKart',
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./pages/not-found-page').then((m) => m.NotFoundPage),
    title: 'Not found — FreshKart',
  },
];
