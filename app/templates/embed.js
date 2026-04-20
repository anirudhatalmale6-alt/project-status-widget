(function() {
    // Advance Forensic Tracker Widget Embed
    var BASE = '{{ request.url_root.rstrip("/") }}';

    // Create iframe
    var iframe = document.createElement('iframe');
    iframe.src = BASE + '/mini';
    iframe.style.cssText = 'position:fixed;bottom:0;right:0;width:400px;height:520px;border:none;z-index:99999;background:transparent;pointer-events:auto;';
    iframe.setAttribute('allow', 'clipboard-write');
    iframe.setAttribute('title', 'Advance Forensic Tracker');

    document.body.appendChild(iframe);
})();
