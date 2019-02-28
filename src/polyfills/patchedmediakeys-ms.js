const inherits = function(childCtor, parentCtor) {
  function tempCtor() {}
  tempCtor.prototype = parentCtor.prototype;
  childCtor.superClass_ = parentCtor.prototype;
  childCtor.prototype = new tempCtor();
  childCtor.prototype.constructor = childCtor;

  childCtor.base = function(me, methodName, var_args) {
    var args = Array.prototype.slice.call(arguments, 2);
    return parentCtor.prototype[methodName].apply(me, args);
  };
};



const shaka = {
  util: {
    EventManager: {},
    Uint8ArrayUtils: {}
  },
  polyfill: {
    PatchedMediaKeysMs: {
      MediaKeySession: {},
    }
  },
}

shaka.util.MultiMap = function() {
  /** @private {!Object.<string, !Array.<T>>} */
  this.map_ = {};
};
/**
 * Add a key, value pair to the map.
 * @param {string} key
 * @param {T} value
 */
shaka.util.MultiMap.prototype.push = function(key, value) {
  if (this.map_.hasOwnProperty(key)) {
    this.map_[key].push(value);
  } else {
    this.map_[key] = [value];
  }
};
/**
 * Get a list of values by key.
 * @param {string} key
 * @return {Array.<T>} or null if no such key exists.
 */
shaka.util.MultiMap.prototype.get = function(key) {
  let list = this.map_[key];
  // slice() clones the list so that it and the map can each be modified
  // without affecting the other.
  return list ? list.slice() : null;
};
/**
 * Get a list of all values.
 * @return {!Array.<T>}
 */
shaka.util.MultiMap.prototype.getAll = function() {
  let list = [];
  for (let key in this.map_) {
    list.push.apply(list, this.map_[key]);
  }
  return list;
};
/**
 * Remove a specific value, if it exists.
 * @param {string} key
 * @param {T} value
 */
shaka.util.MultiMap.prototype.remove = function(key, value) {
  let list = this.map_[key];
  if (!list) return;
  for (let i = 0; i < list.length; ++i) {
    if (list[i] == value) {
      list.splice(i, 1);
      --i;
    }
  }
};
/**
 * Clear all keys and values from the multimap.
 */
shaka.util.MultiMap.prototype.clear = function() {
  this.map_ = {};
};



/**
 * Convert a Uint8Array to a base64 string.  The output will always use the
 * alternate encoding/alphabet also known as "base64url".
 * @param {!Uint8Array} arr
 * @param {boolean=} padding If true, pad the output with equals signs.
 *   Defaults to true.
 * @return {string}
 * @export
 */
shaka.util.Uint8ArrayUtils.toBase64 = function(arr, padding) {
  // btoa expects a "raw string" where each character is interpreted as a byte.
  let bytes = shaka.util.StringUtils.fromCharCode(arr);
  padding = (padding == undefined) ? true : padding;
  let base64 = window.btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_');
  return padding ? base64 : base64.replace(/=*$/, '');
};
/**
 * Convert a base64 string to a Uint8Array.  Accepts either the standard
 * alphabet or the alternate "base64url" alphabet.
 * @param {string} str
 * @return {!Uint8Array}
 * @export
 */
shaka.util.Uint8ArrayUtils.fromBase64 = function(str) {
  // atob creates a "raw string" where each character is interpreted as a byte.
  let bytes = window.atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  let result = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; ++i) {
    result[i] = bytes.charCodeAt(i);
  }
  return result;
};
/**
 * Convert a hex string to a Uint8Array.
 * @param {string} str
 * @return {!Uint8Array}
 * @export
 */
shaka.util.Uint8ArrayUtils.fromHex = function(str) {
  let arr = new Uint8Array(str.length / 2);
  for (let i = 0; i < str.length; i += 2) {
    arr[i / 2] = window.parseInt(str.substr(i, 2), 16);
  }
  return arr;
};
/**
 * Convert a Uint8Array to a hex string.
 * @param {!Uint8Array} arr
 * @return {string}
 * @export
 */
shaka.util.Uint8ArrayUtils.toHex = function(arr) {
  let hex = '';
  for (let i = 0; i < arr.length; ++i) {
    let value = arr[i].toString(16);
    if (value.length == 1) value = '0' + value;
    hex += value;
  }
  return hex;
};
/**
 * Compare two Uint8Arrays for equality.
 * @param {Uint8Array} arr1
 * @param {Uint8Array} arr2
 * @return {boolean}
 * @export
 */
shaka.util.Uint8ArrayUtils.equal = function(arr1, arr2) {
  if (!arr1 && !arr2) return true;
  if (!arr1 || !arr2) return false;
  if (arr1.length != arr2.length) return false;
  for (let i = 0; i < arr1.length; ++i) {
    if (arr1[i] != arr2[i]) return false;
  }
  return true;
};
/**
 * Concatenate Uint8Arrays.
 * @param {...!Uint8Array} varArgs
 * @return {!Uint8Array}
 * @export
 */
shaka.util.Uint8ArrayUtils.concat = function(...varArgs) {
  let totalLength = 0;
  for (let i = 0; i < varArgs.length; ++i) {
    totalLength += varArgs[i].length;
  }

  let result = new Uint8Array(totalLength);
  let offset = 0;
  for (let i = 0; i < varArgs.length; ++i) {
    result.set(varArgs[i], offset);
    offset += varArgs[i].length;
  }
  return result;
};



/**
 * Parse a PSSH box and extract the system IDs.
 *
 * @param {!Uint8Array} psshBox
 * @constructor
 * @struct
 * @throws {shaka.util.Error} if a PSSH box is truncated or contains a size
 *   field over 53 bits.
 */
shaka.util.Pssh = function(psshBox) {
  /**
   * In hex.
   * @type {!Array.<string>}
   */
  this.systemIds = [];

  /**
   * In hex.
   * @type {!Array.<string>}
   */
  this.cencKeyIds = [];

  /*
  * Array of tuples that define the startIndex + size for each
  * discrete pssh within |psshBox|
  * */
  this.dataBoundaries = [];

  // new shaka.util.Mp4Parser()
  //     .fullBox('pssh', this.parseBox_.bind(this)).parse(psshBox.buffer);

  if (this.dataBoundaries.length == 0) {
    // shaka.log.warning('No pssh box found!');
  }
};
/**
 * @param {!shaka.util.Mp4Parser.ParsedBox} box
 * @private
 */
shaka.util.Pssh.prototype.parseBox_ = function(box) {
  if (box.version > 1) {
    // shaka.log.warning('Unrecognized PSSH version found!');
    return;
  }

  let systemId = shaka.util.Uint8ArrayUtils.toHex(box.reader.readBytes(16));
  let keyIds = [];
  if (box.version > 0) {
    let numKeyIds = box.reader.readUint32();
    for (let i = 0; i < numKeyIds; ++i) {
      let keyId = shaka.util.Uint8ArrayUtils.toHex(box.reader.readBytes(16));
      keyIds.push(keyId);
    }
  }

  let dataSize = box.reader.readUint32();
  box.reader.skip(dataSize);  // Ignore the data section.

  // Now that everything has been succesfully parsed from this box,
  // update member variables.
  this.cencKeyIds.push.apply(this.cencKeyIds, keyIds);
  this.systemIds.push(systemId);
  this.dataBoundaries.push({
    start: box.start,
    end: box.start + box.size - 1,
  });

  if (box.reader.getPosition() != box.reader.getLength()) {
    // shaka.log.warning('Mismatch between box size and data size!');
  }
};



/**
 * A utility to create Promises with convenient public resolve and reject
 * methods.
 *
 * @constructor
 * @struct
 * @extends {Promise.<T>}
 * @return {Promise.<T>}
 * @template T
 */
shaka.util.PublicPromise = function() {
  let resolvePromise;
  let rejectPromise;

  // Promise.call causes an error.  It seems that inheriting from a native
  // Promise is not permitted by JavaScript interpreters.

  // The work-around is to construct a Promise object, modify it to look like
  // the compiler's picture of PublicPromise, then return it.  The caller of
  // new PublicPromise will receive |promise| instead of |this|, and the
  // compiler will be aware of the additional properties |resolve| and
  // |reject|.

  let promise = new Promise(function(resolve, reject) {
    resolvePromise = resolve;
    rejectPromise = reject;
  });

  promise.resolve = resolvePromise;
  promise.reject = rejectPromise;

  return promise;
};
/** @param {T=} value */
shaka.util.PublicPromise.prototype.resolve = function(value) {};
/** @param {*=} reason */
shaka.util.PublicPromise.prototype.reject = function(reason) {};



/**
 * Create an Event work-alike object based on the provided dictionary.
 * The event should contain all of the same properties from the dict.
 *
 * @param {string} type
 * @param {Object=} dict
 * @constructor
 * @extends {Event}
 */
shaka.util.FakeEvent = function(type, dict = {}) {
  // Take properties from dict if present.
  for (let key in dict) {
    this[key] = dict[key];
  }


  // The properties below cannot be set by the dict.  They are all provided for
  // compatibility with native events.

  /** @const {boolean} */
  this.bubbles = false;

  /** @type {boolean} */
  this.cancelable = false;

  /** @type {boolean} */
  this.defaultPrevented = false;

  /**
   * According to MDN, Chrome uses high-res timers instead of epoch time.
   * Follow suit so that timeStamps on FakeEvents use the same base as
   * on native Events.
   * @const {number}
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Event/timeStamp
   */
  this.timeStamp = window.performance && window.performance.now ?
      window.performance.now() : Date.now();

  /** @const {string} */
  this.type = type;

  /** @const {boolean} */
  this.isTrusted = false;

  /** @type {EventTarget} */
  this.currentTarget = null;

  /** @type {EventTarget} */
  this.target = null;


  /**
   * Non-standard property read by FakeEventTarget to stop processing listeners.
   * @type {boolean}
   */
  this.stopped = false;
};
/**
 * Prevents the default action of the event.  Has no effect if the event isn't
 * cancellable.
 * @override
 */
shaka.util.FakeEvent.prototype.preventDefault = function() {
  if (this.cancelable) {
    this.defaultPrevented = true;
  }
};
/**
 * Stops processing event listeners for this event.  Provided for compatibility
 * with native Events.
 * @override
 */
shaka.util.FakeEvent.prototype.stopImmediatePropagation = function() {
  this.stopped = true;
};
/**
 * Does nothing, since FakeEvents do not bubble.  Provided for compatibility
 * with native Events.
 * @override
 */
shaka.util.FakeEvent.prototype.stopPropagation = function() {};



/**
 * A work-alike for EventTarget.  Only DOM elements may be true EventTargets,
 * but this can be used as a base class to provide event dispatch to non-DOM
 * classes.  Only FakeEvents should be dispatched.
 *
 * @struct
 * @constructor
 * @implements {EventTarget}
 * @exportInterface
 */
shaka.util.FakeEventTarget = function() {
  /**
   * @private {!shaka.util.MultiMap.<shaka.util.FakeEventTarget.ListenerType>}
   */
  this.listeners_ = new shaka.util.MultiMap();

  /**
   * The target of all dispatched events.  Defaults to |this|.
   * @type {EventTarget}
   */
  this.dispatchTarget = this;
};
/**
 * These are the listener types defined in the closure extern for EventTarget.
 * @typedef {EventListener|function(!Event):(boolean|undefined)}
 * @exportInterface
 */
shaka.util.FakeEventTarget.ListenerType;
/**
 * Add an event listener to this object.
 *
 * @param {string} type The event type to listen for.
 * @param {shaka.util.FakeEventTarget.ListenerType} listener The callback or
 *   listener object to invoke.
 * @param {(!AddEventListenerOptions|boolean)=} options Ignored.
 * @override
 * @exportInterface
 */
shaka.util.FakeEventTarget.prototype.addEventListener =
    function(type, listener, options) {
  this.listeners_.push(type, listener);
};
/**
 * Remove an event listener from this object.
 *
 * @param {string} type The event type for which you wish to remove a listener.
 * @param {shaka.util.FakeEventTarget.ListenerType} listener The callback or
 *   listener object to remove.
 * @param {(EventListenerOptions|boolean)=} options Ignored.
 * @override
 * @exportInterface
 */
shaka.util.FakeEventTarget.prototype.removeEventListener =
    function(type, listener, options) {
  this.listeners_.remove(type, listener);
};
/**
 * Dispatch an event from this object.
 *
 * @param {!Event} event The event to be dispatched from this object.
 * @return {boolean} True if the default action was prevented.
 * @override
 * @exportInterface
 */
shaka.util.FakeEventTarget.prototype.dispatchEvent = function(event) {
  // In many browsers, it is complex to overwrite properties of actual Events.
  // Here we expect only to dispatch FakeEvents, which are simpler.
  let list = this.listeners_.get(event.type) || [];

  for (let i = 0; i < list.length; ++i) {
    // Do this every time, since events can be re-dispatched from handlers.
    event.target = this.dispatchTarget;
    event.currentTarget = this.dispatchTarget;

    let listener = list[i];
    try {
      if (listener.handleEvent) {
        listener.handleEvent(event);
      } else {
        listener.call(this, event);
      }
    } catch (exception) {
      // Exceptions during event handlers should not affect the caller,
      // but should appear on the console as uncaught, according to MDN:
      // https://mzl.la/2JXgwRo
      // shaka.log.error('Uncaught exception in event handler', exception,
      //     exception ? exception.message : null,
      //     exception ? exception.stack : null);
    }

    if (event.stopped) {
      break;
    }
  }

  return event.defaultPrevented;
};



/**
 * Creates a new EventManager. An EventManager maintains a collection of "event
 * bindings" between event targets and event listeners.
 *
 * @struct
 * @constructor
 * @implements {shaka.util.IDestroyable}
 */
shaka.util.EventManager = function() {
  this.bindingMap_ = new shaka.util.MultiMap();
};
/**
 * @typedef {function(!Event)}
 */
shaka.util.EventManager.ListenerType;
/**
 * Detaches all event listeners.
 * @override
 */
shaka.util.EventManager.prototype.destroy = function() {
  this.removeAll();
  this.bindingMap_ = null;
  return Promise.resolve();
};
/**
 * Attaches an event listener to an event target.
 * @param {EventTarget} target The event target.
 * @param {string} type The event type.
 * @param {shaka.util.EventManager.ListenerType} listener The event listener.
 */
shaka.util.EventManager.prototype.listen = function(target, type, listener) {
  if (!this.bindingMap_) return;

  let binding = new shaka.util.EventManager.Binding_(target, type, listener);
  this.bindingMap_.push(type, binding);
};
/**
 * Attaches an event listener to an event target.  The listener will be removed
 * when the first instance of the event is fired.
 * @param {EventTarget} target The event target.
 * @param {string} type The event type.
 * @param {shaka.util.EventManager.ListenerType} listener The event listener.
 */
shaka.util.EventManager.prototype.listenOnce =
    function(target, type, listener) {
  // Install a shim listener that will stop listening after the first event.
  this.listen(target, type, function(event) {
    // Stop listening to this event.
    this.unlisten(target, type);
    // Call the original listener.
    listener(event);
  }.bind(this));
};
/**
 * Detaches an event listener from an event target.
 * @param {EventTarget} target The event target.
 * @param {string} type The event type.
 */
shaka.util.EventManager.prototype.unlisten = function(target, type) {
  if (!this.bindingMap_) return;

  let list = this.bindingMap_.get(type) || [];

  for (let i = 0; i < list.length; ++i) {
    let binding = list[i];

    if (binding.target == target) {
      binding.unlisten();
      this.bindingMap_.remove(type, binding);
    }
  }
};
/**
 * Detaches all event listeners from all targets.
 */
shaka.util.EventManager.prototype.removeAll = function() {
  if (!this.bindingMap_) return;

  let list = this.bindingMap_.getAll();

  for (let i = 0; i < list.length; ++i) {
    list[i].unlisten();
  }

  this.bindingMap_.clear();
};
/**
 * Creates a new Binding_ and attaches the event listener to the event target.
 * @param {EventTarget} target The event target.
 * @param {string} type The event type.
 * @param {shaka.util.EventManager.ListenerType} listener The event listener.
 * @constructor
 * @private
 */
shaka.util.EventManager.Binding_ = function(target, type, listener) {
  /** @type {EventTarget} */
  this.target = target;

  /** @type {string} */
  this.type = type;

  /** @type {?shaka.util.EventManager.ListenerType} */
  this.listener = listener;

  this.target.addEventListener(type, listener, false);
};
/**
 * Detaches the event listener from the event target. This does nothing if the
 * event listener is already detached.
 */
shaka.util.EventManager.Binding_.prototype.unlisten = function() {
  this.target.removeEventListener(this.type, this.listener, false);

  this.target = null;
  this.listener = null;
};



shaka.polyfill.PatchedMediaKeysMs.install = function() {
  if (!window.HTMLVideoElement || !window.MSMediaKeys ||
      (navigator.requestMediaKeySystemAccess &&
       MediaKeySystemAccess.prototype.getConfiguration)) {
    return;
  }
  // Alias
  const PatchedMediaKeysMs = shaka.polyfill.PatchedMediaKeysMs;

  // Construct a fake key ID.  This is not done at load-time to avoid exceptions
  // on unsupported browsers.  This particular fake key ID was suggested in
  // w3c/encrypted-media#32.
  PatchedMediaKeysMs.MediaKeyStatusMap.KEY_ID_ = (new Uint8Array([0])).buffer;

  // Delete mediaKeys to work around strict mode compatibility issues.
  delete HTMLMediaElement.prototype['mediaKeys'];
  // Work around read-only declaration for mediaKeys by using a string.
  HTMLMediaElement.prototype['mediaKeys'] = null;
  HTMLMediaElement.prototype.setMediaKeys = PatchedMediaKeysMs.setMediaKeys;

  // Install patches
  window.MediaKeys = PatchedMediaKeysMs.MediaKeys;
  window.MediaKeySystemAccess = PatchedMediaKeysMs.MediaKeySystemAccess;
  navigator.requestMediaKeySystemAccess =
      PatchedMediaKeysMs.requestMediaKeySystemAccess;
};
/**
 * An implementation of navigator.requestMediaKeySystemAccess.
 * Retrieves a MediaKeySystemAccess object.
 *
 * @this {!Navigator}
 * @param {string} keySystem
 * @param {!Array.<!MediaKeySystemConfiguration>} supportedConfigurations
 * @return {!Promise.<!MediaKeySystemAccess>}
 */
shaka.polyfill.PatchedMediaKeysMs.requestMediaKeySystemAccess =
    function(keySystem, supportedConfigurations) {
  // Alias.
  const PatchedMediaKeysMs = shaka.polyfill.PatchedMediaKeysMs;
  try {
    let access = new PatchedMediaKeysMs.MediaKeySystemAccess(
        keySystem, supportedConfigurations);
    return Promise.resolve(/** @type {!MediaKeySystemAccess} */ (access));
  } catch (exception) {
    return Promise.reject(exception);
  }
};
/**
 * An implementation of MediaKeySystemAccess.
 *
 * @constructor
 * @struct
 * @param {string} keySystem
 * @param {!Array.<!MediaKeySystemConfiguration>} supportedConfigurations
 * @implements {MediaKeySystemAccess}
 * @throws {Error} if the key system is not supported.
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeySystemAccess =
    function(keySystem, supportedConfigurations) {

  /** @type {string} */
  this.keySystem = keySystem;

  /** @private {!MediaKeySystemConfiguration} */
  this.configuration_;

  let allowPersistentState = false;

  let success = false;
  for (let i = 0; i < supportedConfigurations.length; ++i) {
    let cfg = supportedConfigurations[i];

    // Create a new config object and start adding in the pieces which we
    // find support for.  We will return this from getConfiguration() if asked.
    /** @type {!MediaKeySystemConfiguration} */
    let newCfg = {
      'audioCapabilities': [],
      'videoCapabilities': [],
      // It is technically against spec to return these as optional, but we
      // don't truly know their values from the prefixed API:
      'persistentState': 'optional',
      'distinctiveIdentifier': 'optional',
      // Pretend the requested init data types are supported, since we don't
      // really know that either:
      'initDataTypes': cfg.initDataTypes,
      'sessionTypes': ['temporary'],
      'label': cfg.label,
    };

    // PatchedMediaKeysMs tests for key system availability through
    // MSMediaKeys.isTypeSupported
    let ranAnyTests = false;
    if (cfg.audioCapabilities) {
      for (let j = 0; j < cfg.audioCapabilities.length; ++j) {
        let cap = cfg.audioCapabilities[j];
        if (cap.contentType) {
          ranAnyTests = true;
          let contentType = cap.contentType.split(';')[0];
          if (MSMediaKeys.isTypeSupported(this.keySystem, contentType)) {
            newCfg.audioCapabilities.push(cap);
            success = true;
          }
        }
      }
    }
    if (cfg.videoCapabilities) {
      for (let j = 0; j < cfg.videoCapabilities.length; ++j) {
        let cap = cfg.videoCapabilities[j];
        if (cap.contentType) {
          ranAnyTests = true;
          let contentType = cap.contentType.split(';')[0];
          if (MSMediaKeys.isTypeSupported(this.keySystem, contentType)) {
            newCfg.videoCapabilities.push(cap);
            success = true;
          }
        }
      }
    }

    if (!ranAnyTests) {
      // If no specific types were requested, we check all common types to find
      // out if the key system is present at all.
      success = MSMediaKeys.isTypeSupported(this.keySystem, 'video/mp4');
    }
    if (cfg.persistentState == 'required') {
      if (allowPersistentState) {
        newCfg.persistentState = 'required';
        newCfg.sessionTypes = ['persistent-license'];
      } else {
        success = false;
      }
    }

    if (success) {
      this.configuration_ = newCfg;
      return;
    }
  }  // for each cfg in supportedConfigurations

  // As per the spec, this should be a DOMException, but there is not a public
  // constructor for this.
  let unsupportedKeySystemError = new Error('Unsupported keySystem');
  unsupportedKeySystemError.name = 'NotSupportedError';
  unsupportedKeySystemError.code = DOMException.NOT_SUPPORTED_ERR;
  throw unsupportedKeySystemError;
};
/** @override */
shaka.polyfill.PatchedMediaKeysMs.MediaKeySystemAccess.prototype.
    createMediaKeys = function() {
  // Alias
  const PatchedMediaKeysMs = shaka.polyfill.PatchedMediaKeysMs;

  let mediaKeys = new PatchedMediaKeysMs.MediaKeys(this.keySystem);
  return Promise.resolve(/** @type {!MediaKeys} */ (mediaKeys));
};
/** @override */
shaka.polyfill.PatchedMediaKeysMs.MediaKeySystemAccess.prototype.
    getConfiguration = function() {
  return this.configuration_;
};
/**
 * An implementation of HTMLMediaElement.prototype.setMediaKeys.
 * Attaches a MediaKeys object to the media element.
 *
 * @this {!HTMLMediaElement}
 * @param {MediaKeys} mediaKeys
 * @return {!Promise}
 */
shaka.polyfill.PatchedMediaKeysMs.setMediaKeys = function(mediaKeys) {
  // Alias
  const PatchedMediaKeysMs = shaka.polyfill.PatchedMediaKeysMs;

  let newMediaKeys =
      /** @type {shaka.polyfill.PatchedMediaKeysMs.MediaKeys} */ (
      mediaKeys);
  let oldMediaKeys =
      /** @type {shaka.polyfill.PatchedMediaKeysMs.MediaKeys} */ (
      this.mediaKeys);

  if (oldMediaKeys && oldMediaKeys != newMediaKeys) {
    // Have the old MediaKeys stop listening to events on the video tag.
    oldMediaKeys.setMedia(null);
  }

  delete this['mediaKeys'];  // in case there is an existing getter
  this['mediaKeys'] = mediaKeys;  // work around read-only declaration

  if (newMediaKeys) {
    return newMediaKeys.setMedia(this);
  }

  return Promise.resolve();
};
/**
 * An implementation of MediaKeys.
 *
 * @constructor
 * @struct
 * @param {string} keySystem
 * @implements {MediaKeys}
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeys = function(keySystem) {
  /** @private {!MSMediaKeys} */
  this.nativeMediaKeys_ = new MSMediaKeys(keySystem);

  /** @private {!shaka.util.EventManager} */
  this.eventManager_ = new shaka.util.EventManager();
};
/** @override */
shaka.polyfill.PatchedMediaKeysMs.MediaKeys.prototype.
    createSession = function(sessionType) {
  sessionType = sessionType || 'temporary';
  // For now, only the 'temporary' type is supported.
  if (sessionType != 'temporary') {
    throw new TypeError('Session type ' + sessionType +
        ' is unsupported on this platform.');
  }

  // Alias
  const PatchedMediaKeysMs = shaka.polyfill.PatchedMediaKeysMs;

  return new PatchedMediaKeysMs.MediaKeySession(
      this.nativeMediaKeys_, sessionType);
};
/** @override */
shaka.polyfill.PatchedMediaKeysMs.MediaKeys.prototype.
    setServerCertificate = function(serverCertificate) {
  // There is no equivalent in PatchedMediaKeysMs, so return failure.
  return Promise.resolve(false);
};
/**
 * @param {HTMLMediaElement} media
 * @protected
 * @return {!Promise}
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeys.prototype.
    setMedia = function(media) {
  // Alias
  const PatchedMediaKeysMs = shaka.polyfill.PatchedMediaKeysMs;

  // Remove any old listeners.
  this.eventManager_.removeAll();

  // It is valid for media to be null; null is used to flag that event handlers
  // need to be cleaned up.
  if (!media) {
    return Promise.resolve();
  }

  // Intercept and translate these prefixed EME events.
  this.eventManager_.listen(media, 'msneedkey',
      /** @type {shaka.util.EventManager.ListenerType} */
      (PatchedMediaKeysMs.onMsNeedKey_));

  let self = this;
  function setMediaKeysDeferred() {
    media.msSetMediaKeys(self.nativeMediaKeys_);
    media.removeEventListener('loadedmetadata', setMediaKeysDeferred);
  }

  // Wrap native HTMLMediaElement.msSetMediaKeys with a Promise.
  try {
    // IE11/Edge requires that readyState >=1 before mediaKeys can be set, so
    // check this and wait for loadedmetadata if we are not in the correct state
    if (media.readyState >= 1) {
      media.msSetMediaKeys(this.nativeMediaKeys_);
    } else {
      media.addEventListener('loadedmetadata', setMediaKeysDeferred);
    }

    return Promise.resolve();
  } catch (exception) {
    return Promise.reject(exception);
  }
};
/**
 * An implementation of MediaKeySession.
 *
 * @constructor
 * @struct
 * @param {MSMediaKeys} nativeMediaKeys
 * @param {string} sessionType
 * @implements {MediaKeySession}
 * @extends {shaka.util.FakeEventTarget}
 */
shaka.polyfill.PatchedMediaKeysMs.
    MediaKeySession = function(nativeMediaKeys, sessionType) {
  shaka.util.FakeEventTarget.call(this);

  // The native MediaKeySession, which will be created in generateRequest.
  /** @private {MSMediaKeySession} */
  this.nativeMediaKeySession_ = null;

  /** @private {MSMediaKeys} */
  this.nativeMediaKeys_ = nativeMediaKeys;

  // Promises that are resolved later
  /** @private {shaka.util.PublicPromise} */
  this.generateRequestPromise_ = null;

  /** @private {shaka.util.PublicPromise} */
  this.updatePromise_ = null;

  /** @private {!shaka.util.EventManager} */
  this.eventManager_ = new shaka.util.EventManager();

  /** @type {string} */
  this.sessionId = '';

  /** @type {number} */
  this.expiration = NaN;

  /** @type {!shaka.util.PublicPromise} */
  this.closed = new shaka.util.PublicPromise();

  /** @type {!shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap} */
  this.keyStatuses =
      new shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap();
};
inherits(shaka.polyfill.PatchedMediaKeysMs.MediaKeySession,
  shaka.util.FakeEventTarget);
/** @override */
shaka.polyfill.PatchedMediaKeysMs.MediaKeySession.prototype.
    generateRequest = function(initDataType, initData) {
  this.generateRequestPromise_ = new shaka.util.PublicPromise();

  try {
    // This EME spec version requires a MIME content type as the 1st param
    // to createSession, but doesn't seem to matter what the value is.

    // NOTE: IE11 takes either Uint8Array or ArrayBuffer, but Edge 12 only
    // accepts Uint8Array.
    this.nativeMediaKeySession_ = this.nativeMediaKeys_
        .createSession('video/mp4', new Uint8Array(initData), null);

    // Attach session event handlers here.
    this.eventManager_.listen(this.nativeMediaKeySession_, 'mskeymessage',
        /** @type {shaka.util.EventManager.ListenerType} */
        (this.onMsKeyMessage_.bind(this)));
    this.eventManager_.listen(this.nativeMediaKeySession_, 'mskeyadded',
        /** @type {shaka.util.EventManager.ListenerType} */
        (this.onMsKeyAdded_.bind(this)));
    this.eventManager_.listen(this.nativeMediaKeySession_, 'mskeyerror',
        /** @type {shaka.util.EventManager.ListenerType} */
        (this.onMsKeyError_.bind(this)));

    this.updateKeyStatus_('status-pending');
  } catch (exception) {
    this.generateRequestPromise_.reject(exception);
  }

  return this.generateRequestPromise_;
};
/** @override */
shaka.polyfill.PatchedMediaKeysMs.MediaKeySession.prototype.
    load = function() {
  return Promise.reject(new Error('MediaKeySession.load not yet supported'));
};
/** @override */
shaka.polyfill.PatchedMediaKeysMs.MediaKeySession.prototype.
    update = function(response) {
  this.updatePromise_ = new shaka.util.PublicPromise();

  try {
    // Pass through to the native session.
    // NOTE: IE11 takes either Uint8Array or ArrayBuffer, but Edge 12 only
    // accepts Uint8Array.
    this.nativeMediaKeySession_.update(new Uint8Array(response));
  } catch (exception) {
    this.updatePromise_.reject(exception);
  }

  return this.updatePromise_;
};
/** @override */
shaka.polyfill.PatchedMediaKeysMs.MediaKeySession.prototype.
    close = function() {
  try {
    // Pass through to the native session.
    // NOTE: IE seems to have a spec discrepancy here - v2010218 should have
    // MediaKeySession.release, but actually uses "close". The next version
    // of the spec is the initial Promise based one, so it's not the target spec
    // either.
    this.nativeMediaKeySession_.close();

    this.closed.resolve();
    this.eventManager_.removeAll();
  } catch (exception) {
    this.closed.reject(exception);
  }

  return this.closed;
};
/** @override */
shaka.polyfill.PatchedMediaKeysMs.MediaKeySession.prototype.
    remove = function() {
  return Promise.reject(new Error('MediaKeySession.remove is only ' +
      'applicable for persistent licenses, which are not supported on ' +
      'this platform'));
};
/**
 * Handler for the native media elements msNeedKey event.
 *
 * @this {!HTMLMediaElement}
 * @param {!MediaKeyEvent} event
 * @private
 */
shaka.polyfill.PatchedMediaKeysMs.onMsNeedKey_ = function(event) {
  // Alias
  const PatchedMediaKeysMs = shaka.polyfill.PatchedMediaKeysMs;

  // NOTE: Because "this" is a real EventTarget, on IE, the event we dispatch
  // here must also be a real Event.
  let event2 = /** @type {!CustomEvent} */(document.createEvent('CustomEvent'));
  event2.initCustomEvent('encrypted', false, false, null);
  event2.initDataType = 'cenc';
  event2.initData = PatchedMediaKeysMs.normaliseInitData_(event.initData);

  this.dispatchEvent(event2);
};
/**
 * Normalise the initData array. This is to apply browser specific work-arounds,
 * e.g. removing duplicates which appears to occur intermittently when the
 * native msneedkey event fires (i.e. event.initData contains dupes).
 *
 * @param {?Uint8Array} initData
 * @private
 * @return {?Uint8Array}
 */
shaka.polyfill.PatchedMediaKeysMs.normaliseInitData_ = function(initData) {
  if (!initData) {
    return initData;
  }

  let pssh = new shaka.util.Pssh(initData);

  // If there is only a single pssh, return the original array.
  if (pssh.dataBoundaries.length <= 1) {
    return initData;
  }

  let unfilteredInitDatas = [];
  for (let i = 0; i < pssh.dataBoundaries.length; i++) {
    let currPssh = initData.subarray(
        pssh.dataBoundaries[i].start,
        pssh.dataBoundaries[i].end + 1); // End is exclusive, hence the +1.

    unfilteredInitDatas.push(currPssh);
  }

  // Dedupe psshData.
  let dedupedInitDatas = shaka.util.ArrayUtils.removeDuplicates(
      unfilteredInitDatas,
      shaka.polyfill.PatchedMediaKeysMs.compareInitDatas_);

  let targetLength = 0;
  for (let i = 0; i < dedupedInitDatas.length; i++) {
    targetLength += dedupedInitDatas[i].length;
  }

  // Flatten the array of Uint8Arrays back into a single Uint8Array.
  let normalisedInitData = new Uint8Array(targetLength);
  let offset = 0;
  for (let i = 0; i < dedupedInitDatas.length; i++) {
    normalisedInitData.set(dedupedInitDatas[i], offset);
    offset += dedupedInitDatas[i].length;
  }

  return normalisedInitData;
};
/**
 * @param {!Uint8Array} initDataA
 * @param {!Uint8Array} initDataB
 * @return {boolean}
 * @private
 */
shaka.polyfill.PatchedMediaKeysMs.compareInitDatas_ =
    function(initDataA, initDataB) {
  return shaka.util.Uint8ArrayUtils.equal(initDataA, initDataB);
};
/**
 * Handler for the native keymessage event on MSMediaKeySession.
 *
 * @param {!MediaKeyEvent} event
 * @private
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeySession.prototype.
    onMsKeyMessage_ = function(event) {

  // We can now resolve this.generateRequestPromise, which should be non-null.
  if (this.generateRequestPromise_) {
    this.generateRequestPromise_.resolve();
    this.generateRequestPromise_ = null;
  }

  let isNew = this.keyStatuses.getStatus() == undefined;

  let event2 = new shaka.util.FakeEvent('message', {
    messageType: isNew ? 'licenserequest' : 'licenserenewal',
    message: event.message.buffer,
  });

  this.dispatchEvent(event2);
};
/**
 * Handler for the native keyadded event on MSMediaKeySession.
 *
 * @param {!MediaKeyEvent} event
 * @private
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeySession.prototype.
    onMsKeyAdded_ = function(event) {

  // PlayReady's concept of persistent licenses makes emulation difficult here.
  // A license policy can say that the license persists, which causes the CDM to
  // store it for use in a later session.  The result is that in IE11, the CDM
  // fires 'mskeyadded' without ever firing 'mskeymessage'.
  if (this.generateRequestPromise_) {
    this.updateKeyStatus_('usable');
    this.generateRequestPromise_.resolve();
    this.generateRequestPromise_ = null;
    return;
  }

  // We can now resolve this.updatePromise, which should be non-null.
  if (this.updatePromise_) {
    this.updateKeyStatus_('usable');
    this.updatePromise_.resolve();
    this.updatePromise_ = null;
  }
};
/**
 * Handler for the native keyerror event on MSMediaKeySession.
 *
 * @param {!MediaKeyEvent} event
 * @private
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeySession.prototype.
    onMsKeyError_ = function(event) {

  let error = new Error('EME PatchedMediaKeysMs key error');
  error.errorCode = this.nativeMediaKeySession_.error;

  if (this.generateRequestPromise_ != null) {
    this.generateRequestPromise_.reject(error);
    this.generateRequestPromise_ = null;
  } else if (this.updatePromise_ != null) {
    this.updatePromise_.reject(error);
    this.updatePromise_ = null;
  } else {
    // Unexpected error - map native codes to standardised key statuses.
    // Possible values of this.nativeMediaKeySession_.error.code:
    // MS_MEDIA_KEYERR_UNKNOWN        = 1
    // MS_MEDIA_KEYERR_CLIENT         = 2
    // MS_MEDIA_KEYERR_SERVICE        = 3
    // MS_MEDIA_KEYERR_OUTPUT         = 4
    // MS_MEDIA_KEYERR_HARDWARECHANGE = 5
    // MS_MEDIA_KEYERR_DOMAIN         = 6

    switch (this.nativeMediaKeySession_.error.code) {
      case MSMediaKeyError.MS_MEDIA_KEYERR_OUTPUT:
      case MSMediaKeyError.MS_MEDIA_KEYERR_HARDWARECHANGE:
        this.updateKeyStatus_('output-not-allowed');
        break;
      default:
        this.updateKeyStatus_('internal-error');
        break;
    }
  }
};
/**
 * Updates key status and dispatch a 'keystatuseschange' event.
 *
 * @param {string} status
 * @private
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeySession.prototype.
    updateKeyStatus_ = function(status) {
  this.keyStatuses.setStatus(status);
  let event = new shaka.util.FakeEvent('keystatuseschange');
  this.dispatchEvent(event);
};
/**
 * An implementation of MediaKeyStatusMap.
 * This fakes a map with a single key ID.
 *
 * @constructor
 * @struct
 * @implements {MediaKeyStatusMap}
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap = function() {
  /**
   * @type {number}
   */
  this.size = 0;

  /**
   * @private {string|undefined}
   */
  this.status_ = undefined;
};
/**
 * @const {!ArrayBuffer}
 * @private
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap.KEY_ID_;
/**
 * An internal method used by the session to set key status.
 * @param {string|undefined} status
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap.prototype.
    setStatus = function(status) {
  this.size = status == undefined ? 0 : 1;
  this.status_ = status;
};
/**
 * An internal method used by the session to get key status.
 * @return {string|undefined}
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap.prototype.
    getStatus = function() {
  return this.status_;
};
/** @override */
shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap.prototype.
    forEach = function(fn) {
  if (this.status_) {
    let fakeKeyId =
        shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap.KEY_ID_;
    fn(this.status_, fakeKeyId);
  }
};
/** @override */
shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap.prototype.
    get = function(keyId) {
  if (this.has(keyId)) {
    return this.status_;
  }
  return undefined;
};
/** @override */
shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap.prototype.
    has = function(keyId) {
  let fakeKeyId =
      shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap.KEY_ID_;
  if (this.status_ &&
      shaka.util.Uint8ArrayUtils.equal(
          new Uint8Array(keyId), new Uint8Array(fakeKeyId))) {
    return true;
  }
  return false;
};
/**
 * @suppress {missingReturn}
 * @override
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap.prototype.
    entries = function() {};
/**
 * @suppress {missingReturn}
 * @override
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap.prototype.
    keys = function() {};
/**
 * @suppress {missingReturn}
 * @override
 */
shaka.polyfill.PatchedMediaKeysMs.MediaKeyStatusMap.prototype.
    values = function() {};



export default shaka.polyfill.PatchedMediaKeysMs;
