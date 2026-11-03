import type { Routes } from '@angular/router';

const listados = () => import('./listados');

export const rutasDocumentos: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'ordenes-retiro' },
  {
    path: 'ordenes-retiro',
    title: 'Órdenes de retiro · NexusTrack',
    loadComponent: () => listados().then((m) => m.ListaOrdenesRetiro),
  },
  {
    path: 'ordenes-retiro/nuevo',
    title: 'Nueva orden de retiro · NexusTrack',
    loadComponent: () => import('./orden-retiro').then((m) => m.OrdenRetiro),
  },
  {
    path: 'ordenes-retiro/:id',
    title: 'Orden de retiro · NexusTrack',
    loadComponent: () => import('./orden-retiro').then((m) => m.OrdenRetiro),
  },
  {
    path: 'ordenes-carga',
    title: 'Órdenes de carga · NexusTrack',
    loadComponent: () => listados().then((m) => m.ListaOrdenesCarga),
  },
  {
    path: 'ordenes-carga/nuevo',
    title: 'Nueva orden de carga · NexusTrack',
    loadComponent: () => import('./orden-carga').then((m) => m.OrdenCarga),
  },
  {
    path: 'ordenes-carga/:id',
    title: 'Orden de carga · NexusTrack',
    loadComponent: () => import('./orden-carga').then((m) => m.OrdenCarga),
  },
  {
    path: 'hojas-ruta',
    title: 'Hojas de ruta · NexusTrack',
    loadComponent: () => listados().then((m) => m.ListaHojasRuta),
  },
  {
    path: 'hojas-ruta/:id',
    title: 'Hoja de ruta · NexusTrack',
    loadComponent: () => import('./hoja-ruta').then((m) => m.HojaRuta),
  },
  {
    path: 'vales-dinero',
    title: 'Vales de dinero · NexusTrack',
    loadComponent: () => listados().then((m) => m.ListaValesDinero),
  },
  {
    path: 'vales-dinero/nuevo',
    title: 'Nuevo vale de dinero · NexusTrack',
    loadComponent: () => import('./vale-dinero').then((m) => m.ValeDinero),
  },
  {
    path: 'vales-dinero/:id',
    title: 'Vale de dinero · NexusTrack',
    loadComponent: () => import('./vale-dinero').then((m) => m.ValeDinero),
  },
  {
    path: 'vales-combustible',
    title: 'Vales de combustible · NexusTrack',
    loadComponent: () => listados().then((m) => m.ListaValesCombustible),
  },
  {
    path: 'vales-combustible/nuevo',
    title: 'Nuevo vale de combustible · NexusTrack',
    loadComponent: () => import('./vale-combustible').then((m) => m.ValeCombustible),
  },
  {
    path: 'vales-combustible/:id',
    title: 'Vale de combustible · NexusTrack',
    loadComponent: () => import('./vale-combustible').then((m) => m.ValeCombustible),
  },
  {
    path: 'rendiciones',
    title: 'Rendiciones · NexusTrack',
    loadComponent: () => listados().then((m) => m.ListaRendiciones),
  },
  {
    path: 'rendiciones/nuevo',
    title: 'Nueva rendición · NexusTrack',
    loadComponent: () => import('./rendicion').then((m) => m.Rendicion),
  },
  {
    path: 'rendiciones/:id',
    title: 'Rendición · NexusTrack',
    loadComponent: () => import('./rendicion').then((m) => m.Rendicion),
  },
  {
    path: 'estadias',
    title: 'Estadías · NexusTrack',
    loadComponent: () => listados().then((m) => m.ListaEstadias),
  },
  {
    path: 'estadias/nuevo',
    title: 'Nueva estadía · NexusTrack',
    data: { estadia: true },
    loadComponent: () => import('./rendicion').then((m) => m.Rendicion),
  },
  {
    path: 'estadias/:id',
    title: 'Estadía · NexusTrack',
    loadComponent: () => import('./rendicion').then((m) => m.Rendicion),
  },
  {
    path: 'cuentas-conductores',
    title: 'Cuentas de conductores · NexusTrack',
    loadComponent: () => import('./cuentas').then((m) => m.CuentasConductores),
  },
  {
    path: 'cuentas-conductores/:id',
    title: 'Cuenta del conductor · NexusTrack',
    loadComponent: () => import('./cuentas').then((m) => m.CuentaDeConductor),
  },
];
