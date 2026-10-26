/* Datos de la práctica con dinero.
   Billetes (los 8 en circulación): los dibujos son ILUSTRATIVOS (no reproducen los reales) y se usan solo si falta la foto del billete (imágenes: BCRA).
   Los valores y los precios son de práctica y se editan acá, en un solo lugar. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EpeDineroDatos = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BILLETES = [
    { valor: 50, fondo: '#3f8fcf', fondo2: '#9ccdf0', texto: '#0b2a45' },
    { valor: 100, fondo: '#5b3f98', fondo2: '#8c73c4', texto: '#ffffff' },
    { valor: 200, fondo: '#d79a14', fondo2: '#f1c35c', texto: '#2b2108' },
    { valor: 500, fondo: '#2f7d2a', fondo2: '#5fae52', texto: '#ffffff' },
    { valor: 1000, fondo: '#245f9c', fondo2: '#5aa0d8', texto: '#ffffff' },
    { valor: 2000, fondo: '#b94a1f', fondo2: '#e57f55', texto: '#ffffff' },
    { valor: 10000, fondo: '#9a2f5f', fondo2: '#cf6592', texto: '#ffffff' },
    { valor: 20000, fondo: '#343c58', fondo2: '#626d8c', texto: '#ffffff' }
  ];

  // Productos de práctica. Los precios son ejemplos, no precios de comercios.
  var PRODUCTOS = [
    { id: 'caramelo', nombre: 'un caramelo', precio: 100, icono: 'galleta' },
    { id: 'manzana', nombre: 'una manzana', precio: 200, icono: 'fruta' },
    { id: 'pan', nombre: 'un pan', precio: 500, icono: 'pan' },
    { id: 'galletitas', nombre: 'galletitas', precio: 1000, icono: 'galleta' },
    { id: 'alfajor', nombre: 'un alfajor', precio: 600, icono: 'galleta' },
    { id: 'yogur', nombre: 'un yogur', precio: 700, icono: 'carton' },
    { id: 'leche', nombre: 'una leche', precio: 1200, icono: 'carton' },
    { id: 'jugo', nombre: 'un jugo', precio: 1500, icono: 'botella' },
    { id: 'fideos', nombre: 'fideos', precio: 2200, icono: 'bolsa' },
    { id: 'queso', nombre: 'queso', precio: 2500, icono: 'queso' },
    { id: 'arroz', nombre: 'arroz', precio: 2700, icono: 'bolsa' },
    { id: 'yerba', nombre: 'yerba', precio: 3500, icono: 'bolsa' },
    { id: 'aceite', nombre: 'aceite', precio: 4200, icono: 'botella' },
    { id: 'harina', nombre: 'harina', precio: 1800, icono: 'bolsa' },
    { id: 'carne', nombre: 'carne', precio: 10700, icono: 'carne' },
    { id: 'pollo', nombre: 'un pollo', precio: 12000, icono: 'carne' }
  ];

  return { BILLETES: BILLETES, PRODUCTOS: PRODUCTOS };
});
