// @ts-nocheck
/* eslint-disable */
/* Código de terceros adaptado (Apache-2.0), tal cual estaba en el configurador
 * salvo el envoltorio: antes era una función que se ejecutaba sola al cargar y
 * dejaba `window.SerialPolyfill`; ahora es `obtenerPolyfillSerial()`, que hace
 * lo mismo la primera vez que se la llama (y devuelve `null` donde no
 * corresponde instalarlo). NO se le aplican lint ni chequeo de tipos a
 * propósito, para no divergir del original probado. */
/* ─────────────────────────────────────────────────────────────────────
 * Polyfill Web Serial API sobre WebUSB (perfil CDC-ACM)
 * Adaptado de github.com/google/web-serial-polyfill — Apache-2.0, Google LLC
 *
 * OBJETIVO: permitir la conexión USB del configurador desde tablets Android
 * (Chrome) que todavía no traen navigator.serial nativo, usando WebUSB.
 * Caso de uso: configurar disMouse basados en Arduino Pro Micro sin PC.
 *
 * SEGURIDAD DE REGRESIÓN: este bloque NO se instala si navigator.serial ya
 * existe (todo el desktop) ni si falta WebUSB (iOS). En esos casos
 * window.SerialPolyfill queda undefined y connectUSB() usa el camino nativo
 * exactamente como antes. Solo actúa como fallback en Android.
 * ───────────────────────────────────────────────────────────────────── */
export function obtenerPolyfillSerial() {
  if (window.SerialPolyfill) return window.SerialPolyfill; // ya instalado
  if ('serial' in navigator || !('usb' in navigator)) return null; // nativo disponible, o sin WebUSB → no instalar

  var kSetLineCoding = 0x20, kSetControlLineState = 0x22, kSendBreak = 0x23;
  var kBufferSize = 255;
  var CTRL_CLASS = 2;   // CDC Communications
  var DATA_CLASS = 10;  // CDC-Data

  function findInterface(device, classCode) {
    var cfg = device.configurations[0];
    for (var i = 0; i < cfg.interfaces.length; i++) {
      if (cfg.interfaces[i].alternates[0].interfaceClass === classCode) return cfg.interfaces[i];
    }
    throw new TypeError('El dispositivo no expone una interfaz serie CDC (clase ' + classCode + ').');
  }
  function findEndpoint(iface, direction) {
    var eps = iface.alternates[0].endpoints;
    for (var i = 0; i < eps.length; i++) if (eps[i].direction === direction) return eps[i];
    throw new TypeError('La interfaz ' + iface.interfaceNumber + ' no tiene endpoint ' + direction + '.');
  }

  function EndpointSource(device, endpoint, onError) {
    this.type = 'bytes';
    this.pull = function (controller) {
      (async function () {
        var chunkSize = controller.desiredSize
          ? Math.ceil(controller.desiredSize / endpoint.packetSize) * endpoint.packetSize
          : endpoint.packetSize;
        try {
          var result = await device.transferIn(endpoint.endpointNumber, chunkSize);
          if (result.status !== 'ok') { controller.error('USB ' + result.status); onError(); }
          if (result.data && result.data.buffer) {
            controller.enqueue(new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength));
          }
        } catch (e) { controller.error(String(e)); onError(); }
      })();
    };
  }
  function EndpointSink(device, endpoint, onError) {
    this.write = async function (chunk, controller) {
      try {
        var result = await device.transferOut(endpoint.endpointNumber, chunk);
        if (result.status !== 'ok') { controller.error(result.status); onError(); }
      } catch (e) { controller.error(String(e)); onError(); }
    };
  }

  function SerialPort(device) {
    this._device = device;
    this._ctrl = findInterface(device, CTRL_CLASS);
    this._xfer = findInterface(device, DATA_CLASS);
    this._in  = findEndpoint(this._xfer, 'in');
    this._out = findEndpoint(this._xfer, 'out');
    this._readable = null; this._writable = null;
    this._signals = { dataTerminalReady: false, requestToSend: false, break: false };
  }
  Object.defineProperty(SerialPort.prototype, 'readable', {
    get: function () {
      var self = this;
      if (!self._readable && self._device.opened) {
        self._readable = new ReadableStream(
          new EndpointSource(self._device, self._in, function () { self._readable = null; }),
          { highWaterMark: kBufferSize });
      }
      return self._readable;
    }
  });
  Object.defineProperty(SerialPort.prototype, 'writable', {
    get: function () {
      var self = this;
      if (!self._writable && self._device.opened) {
        self._writable = new WritableStream(
          new EndpointSink(self._device, self._out, function () { self._writable = null; }),
          new ByteLengthQueuingStrategy({ highWaterMark: kBufferSize }));
      }
      return self._writable;
    }
  });
  SerialPort.prototype._setLineCoding = async function (baudRate) {
    var view = new DataView(new ArrayBuffer(7));
    view.setUint32(0, baudRate, true); // baudios (little-endian)
    view.setUint8(4, 0);               // 1 stop bit
    view.setUint8(5, 0);               // sin paridad
    view.setUint8(6, 8);               // 8 data bits
    var r = await this._device.controlTransferOut({
      requestType: 'class', recipient: 'interface',
      request: kSetLineCoding, value: 0x00, index: this._ctrl.interfaceNumber
    }, view.buffer);
    if (r.status !== 'ok') throw new DOMException('No se pudo fijar el line coding.', 'NetworkError');
  };
  SerialPort.prototype.setSignals = async function (signals) {
    signals = signals || {};
    Object.assign(this._signals, signals);
    if (signals.dataTerminalReady !== undefined || signals.requestToSend !== undefined) {
      var value = (this._signals.dataTerminalReady ? 1 : 0) | (this._signals.requestToSend ? 2 : 0);
      await this._device.controlTransferOut({
        requestType: 'class', recipient: 'interface',
        request: kSetControlLineState, value: value, index: this._ctrl.interfaceNumber
      });
    }
    if (signals.break !== undefined) {
      await this._device.controlTransferOut({
        requestType: 'class', recipient: 'interface',
        request: kSendBreak, value: this._signals.break ? 0xFFFF : 0x0000, index: this._ctrl.interfaceNumber
      });
    }
  };
  SerialPort.prototype.getInfo = function () {
    return { usbVendorId: this._device.vendorId, usbProductId: this._device.productId };
  };
  SerialPort.prototype.open = async function (options) {
    var baudRate = (options && options.baudRate) || 9600;
    try {
      await this._device.open();
      if (this._device.configuration === null) await this._device.selectConfiguration(1);
      await this._device.claimInterface(this._ctrl.interfaceNumber);
      if (this._ctrl !== this._xfer) await this._device.claimInterface(this._xfer.interfaceNumber);
      await this._setLineCoding(baudRate);
      await this.setSignals({ dataTerminalReady: true }); // Arduino: DTR abre el puerto
    } catch (e) {
      if (this._device.opened) { try { await this._device.close(); } catch (_) {} }
      throw new Error((e && e.message) ? e.message : String(e));
    }
  };
  SerialPort.prototype.close = async function () {
    var p = [];
    if (this._readable) p.push(this._readable.cancel().catch(function () {}));
    if (this._writable) p.push(this._writable.abort().catch(function () {}));
    await Promise.all(p);
    this._readable = null; this._writable = null;
    if (this._device.opened) {
      try { await this.setSignals({ dataTerminalReady: false, requestToSend: false }); } catch (_) {}
      await this._device.close();
    }
  };
  SerialPort.prototype.forget = function () {
    return this._device.forget ? this._device.forget() : Promise.resolve();
  };

  var serial = {
    requestPort: async function (options) {
      var filters = [];
      if (options && options.filters) {
        options.filters.forEach(function (f) {
          var uf = { classCode: CTRL_CLASS };
          if (f.usbVendorId  !== undefined) uf.vendorId  = f.usbVendorId;
          if (f.usbProductId !== undefined) uf.productId = f.usbProductId;
          filters.push(uf);
        });
      }
      if (!filters.length) filters.push({ classCode: CTRL_CLASS }); // cualquier dispositivo serie CDC
      var device = await navigator.usb.requestDevice({ filters: filters });
      return new SerialPort(device);
    },
    getPorts: async function () {
      var devices = await navigator.usb.getDevices();
      var ports = [];
      devices.forEach(function (d) { try { ports.push(new SerialPort(d)); } catch (e) {} });
      return ports;
    }
  };

  window.SerialPolyfill = { serial: serial, SerialPort: SerialPort };
  return window.SerialPolyfill;
}
