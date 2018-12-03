/*
                               The EME specification (https://dvcs.w3.org/hg/html-media/raw-file/tip/encrypted-media/encrypted-media.html) 
                                  is supported starting OSX 10.10 and greater. 
                                                         */
var keySystem;
var certificate;
var serverCertificatePath =
    'https://drm-license.douji.nhk.or.jp/fps/cert'; // ADAPT: This is the path to the fps certificate on your server.
var serverProcessSPCPath =
    'http://localhost:12345/fps/getLicense'; // ADAPT: This is the path/URL to the keyserver module that processes the SPC and returns a CKC

var video;
var startTime, startTimeNormal;

function stringToArray(string) {
    var buffer = new ArrayBuffer(string.length * 2); // 2 bytes for each char
    var array = new Uint16Array(buffer);
    for (var i = 0, strLen = string.length; i < strLen; i++) {
        array[i] = string.charCodeAt(i);
    }
    return array;
}

function arrayToString(array) {
    var uint16array = new Uint16Array(array.buffer);
    return String.fromCharCode.apply(null, uint16array);
}

function base64DecodeUint8Array(input) {
    var raw = window.atob(input);
    var rawLength = raw.length;
    var array = new Uint8Array(new ArrayBuffer(rawLength));

    for (i = 0; i < rawLength; i++)
        array[i] = raw.charCodeAt(i);

    return array;
}

function base64EncodeUint8Array(input) {
    var keyStr = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=";
    var output = "";
    var chr1, chr2, chr3, enc1, enc2, enc3, enc4;
    var i = 0;

    while (i < input.length) {
        chr1 = input[i++];
        chr2 = i < input.length ? input[i++] : Number.NaN; // Not sure if the index
        chr3 = i < input.length ? input[i++] : Number.NaN; // checks are needed here

        enc1 = chr1 >> 2;
        enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
        enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
        enc4 = chr3 & 63;

        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }
        output += keyStr.charAt(enc1) + keyStr.charAt(enc2) +
            keyStr.charAt(enc3) + keyStr.charAt(enc4);
    }
    return output;
}

function waitForEvent(name, action, target) {
    target.addEventListener(name, function () {
        action(arguments[0]);
    }, false);
}

function loadCertificate() {
    startTime = Date.now();
    var request = new XMLHttpRequest();
    request.responseType = 'arraybuffer';
    request.addEventListener('load', onCertificateLoaded, false);
    request.addEventListener('error', onCertificateError, false);
    request.open('GET', serverCertificatePath, true);
    request.setRequestHeader("Cache-Control", "max-age=0");
    request.send();
}

function onCertificateLoaded(event) {
    console.log("certificate loaded")
    var request = event.target;
    certificate = new Uint8Array(request.response);
    startVideo();
}

function onCertificateError(event) {
    window.console.error('Failed to retrieve the server certificate.')
}

function extractContentId(initData) {
    contentId = arrayToString(initData);
    // contentId is passed up as a URI, from which the host must be extracted:
    return contentId.match(/skd:\/\/(.*)/)[1]
}

function concatInitDataIdAndCertificate(initData, id, cert) {
    if (typeof id == "string")
        id = stringToArray(id);
    // layout is [initData][4 byte: idLength][idLength byte: id][4 byte:certLength][certLength byte: cert]
    var offset = 0;
    var buffer = new ArrayBuffer(initData.byteLength + 4 + id.byteLength + 4 + cert.byteLength);
    var dataView = new DataView(buffer);

    var initDataArray = new Uint8Array(buffer, offset, initData.byteLength);
    initDataArray.set(initData);
    offset += initData.byteLength;

    dataView.setUint32(offset, id.byteLength, true);
    offset += 4;

    var idArray = new Uint16Array(buffer, offset, id.length);
    idArray.set(id);
    offset += idArray.byteLength;

    dataView.setUint32(offset, cert.byteLength, true);
    offset += 4;

    var certArray = new Uint8Array(buffer, offset, cert.byteLength);
    certArray.set(cert);

    return new Uint8Array(buffer, 0, buffer.byteLength);
}

function selectKeySystem() {
    if (WebKitMediaKeys.isTypeSupported("com.apple.fps.1_0", "video/mp4")) {
        keySystem = "com.apple.fps.1_0";
    } else {
        throw "Key System not supported";
    }
}

function startVideo() {
    video = document.getElementById('videoDRM');
    video.addEventListener('webkitneedkey', onneedkey, false);
    video.addEventListener('error', onerror, false);
    video.src = drmURL;
    video.play();
    video.addEventListener("playing", function () {
        timelog('playing')
    }, false);

    video.addEventListener("loadeddata", function () {
        timelog('loadeddata')
    }, false);

    video.addEventListener("loadedmetadata", function () {
        timelog('loadedmetadata')
    }, false);

    video.addEventListener("loadstart", function () {
        timelog('loadstart')
    }, false);
}

function playNormal() {
    startTimeNormal = Date.now();
    video = document.getElementById('videoNormal');
    video.addEventListener('error', onerror, false);
    video.src = normalURL;
    video.play();
    video.addEventListener("playing", function () {
        timelogNormal('playing')
    }, false);

    video.addEventListener("loadeddata", function () {
        timelogNormal('loadeddata')
    }, false);

    video.addEventListener("loadedmetadata", function () {
        timelogNormal('loadedmetadata')
    }, false);

    video.addEventListener("loadstart", function () {
        timelogNormal('loadstart')
    }, false);
}

function onerror(event) {
    window.console.error('A video playback error occurred', event)
}

function timelog(log) {
    time = Date.now() - startTime
    timelogDRM = document.getElementById('timelogDRM');
    timelogDRM.insertAdjacentHTML('afterbegin', '<p>' + time + 'ms: ' + log + '</p>');
}

function timelogNormal(log) {
    time = Date.now() - startTimeNormal
    timelogDRM = document.getElementById('timelogNormal');
    timelogDRM.insertAdjacentHTML('afterbegin', '<p>' + time + 'ms: ' + log + '</p>');
}

function onneedkey(event) {
    timelog('onneedkey')
    var video = event.target;
    var initData = event.initData;
    // twelve
    var contentId = extractContentId(initData);
    initData = concatInitDataIdAndCertificate(initData, contentId, certificate);

    if (!video.webkitKeys) {
        selectKeySystem();
        video.webkitSetMediaKeys(new WebKitMediaKeys(keySystem));
    }

    if (!video.webkitKeys)
        throw "Could not create MediaKeys";

    var keySession = video.webkitKeys.createSession("video/mp4", initData);
    if (!keySession)
        throw "Could not create key session";
    keySession.contentId = contentId;
    console.log(keySession)
    waitForEvent('webkitkeymessage', licenseRequestReady, keySession);
    waitForEvent('webkitkeyadded', onkeyadded, keySession);
    waitForEvent('webkitkeyerror', onkeyerror, keySession);
}

/*
    This function assumes the Key Server Module understands the following POST format --
    spc=<base64 encoded data>&assetId=<data>
    ADAPT: Partners must tailor to their own protocol.
*/
function licenseRequestReady(event) {
    var session = event.target;
    var message = event.message;
    var messageStr = new TextDecoder("utf-8").decode(message);
    var request = new XMLHttpRequest();
    var sessionId = event.sessionId;
    console.log(message);
    request.responseType = 'arraybuffer';
    request.session = session;
    request.addEventListener('load', licenseRequestLoaded, false);
    request.addEventListener('error', licenseRequestFailed, false);
    request.open('POST', serverProcessSPCPath, true);
    request.send(message);
}

function licenseRequestLoaded(event) {
    var request = event.target;
    var session = request.session;
    session.update(new Uint8Array(request.response));
    timelog('licenseRequestLoaded')
}

function licenseRequestFailed(event) {
    window.console.error('The license request failed.');
}

function onkeyerror(event) {
    var session = event.target
    console.log(session.error)
    window.console.error('A decryption key error was encountered');
}

function onkeyadded(event) {

    window.console.log('Decryption key was added to session.');
}