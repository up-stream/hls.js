import PatchedMediaKeysMs from '../polyfills/patchedmediakeys-ms';

const requestMediaKeySystemAccess = (function () {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.requestMediaKeySystemAccess) {
    return window.navigator.requestMediaKeySystemAccess.bind(window.navigator);
  } else {
    PatchedMediaKeysMs.install()
    return window.navigator.requestMediaKeySystemAccess
  }
})();

export {
  requestMediaKeySystemAccess
};
